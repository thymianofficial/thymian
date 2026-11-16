import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

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

// A field counts as present when it has a value, as `getHeader` reads it.
const hasFields = (
  headers: Record<string, string | string[] | undefined> | undefined,
): headers is Record<string, string | string[] | undefined> =>
  headers !== undefined &&
  Object.values(headers).some((value) => value !== undefined);

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
      for (let i = 1; i < trace.length; i++) {
        // In a captured trace the proxy's own leg carries meta.role === 'proxy';
        // `received` is that leg (the request the proxy got) and `forwarded` is
        // the next hop (the request the proxy sent onward).
        const received = trace[i - 1];
        const forwarded = trace[i];
        if (!received || !forwarded || received.request.meta.role !== 'proxy') {
          continue;
        }
        const receivedHeaders = received.request.data.headers;
        const forwardedHeaders = forwarded.request.data.headers;
        // A leg with no header field at all is treated as captured without
        // headers, not as a request that carried none: the analyzer reads a leg
        // recorded without headers back as an empty object, never as
        // undefined, and a real forwarded request without a single field is
        // implausible (HTTP/1.1 requires Host). Without both
        // legs' fields a dropped field cannot be told from an unrecorded one,
        // so skip rather than report every received field.
        if (!hasFields(receivedHeaders) || !hasFields(forwardedHeaders)) {
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
