import {
  getHeader,
  httpRule,
  isHeaderCaptured,
  isHeaderCapturedOnBoth,
  type RuleFnResult,
} from '@thymian/core';

import { forwardingHops } from '../../routing/utils/forwarding.js';

// Fields a proxy may legitimately drop, so they are never treated as a
// non-forwarded end-to-end field: hop-by-hop controls plus routing metadata a
// proxy manages on its own hop.
const DROPPABLE = new Set([
  'connection',
  'proxy-connection',
  'keep-alive',
  'te',
  'transfer-encoding',
  'upgrade',
  'host',
]);

const connectionOptionNames = (
  value: string | string[] | undefined,
): string[] =>
  (value === undefined ? [] : Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/proxy-must-forward-unrecognized-header-fields')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1')
  .description(
    'A proxy MUST forward unrecognized header fields unless the field name is listed in the Connection header field (Section 7.6.1) or the proxy is specifically configured to block, or otherwise transform, such fields.',
  )
  .summary('Proxy MUST forward unrecognized header fields unless excepted.')
  .explanation(
    'When a proxy relays a request, it must pass along header fields it does not itself recognize rather than stripping them, unless the field is named in the Connection header (a hop-by-hop control) or the proxy is explicitly configured to remove or transform it. This lets new HTTP features and extensions travel end-to-end and work correctly even though the intermediaries in between were deployed before those features existed, so the protocol can evolve without upgrading every proxy on the path.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (const { inbound, outbound } of forwardingHops(trace, ['proxy'])) {
        // The proxy received `inbound.request` and forwarded `outbound.request`.
        const received = inbound.request;
        const forwarded = outbound.request;
        const receivedHeaders = received.data.headers ?? {};
        const forwardedHeaders = forwarded.data.headers;
        // Without the received Connection field the excepted names are
        // unknown, so nothing on this pair can be judged.
        if (!isHeaderCaptured(received, 'connection')) {
          continue;
        }
        const excepted = new Set([
          ...DROPPABLE,
          ...connectionOptionNames(getHeader(receivedHeaders, 'connection')),
        ]);
        const dropped = Object.keys(receivedHeaders)
          .map((name) => name.toLowerCase())
          .filter(
            (name) =>
              !excepted.has(name) &&
              // A field not captured on either side cannot show a drop.
              isHeaderCapturedOnBoth(received, forwarded, name) &&
              getHeader(forwardedHeaders, name) === undefined,
          );
        if (dropped.length > 0) {
          results.push({
            location,
            violation: {
              message: `A proxy did not forward header field(s) (${dropped.join(', ')}) present on the received request.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
