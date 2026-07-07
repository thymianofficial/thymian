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

const connectionOptionNames = (value: string | string[] | undefined): string[] =>
  (value === undefined ? [] : Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

export default httpRule('rfc9110/proxy-must-forward-unrecognized-header-fields')
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1')
  .description(
    'A proxy MUST forward unrecognized header fields unless the field name is listed in the Connection header field (Section 7.6.1) or the proxy is specifically configured to block, or otherwise transform, such fields.',
  )
  .summary('Proxy MUST forward unrecognized header fields unless excepted.')
  .appliesTo('proxy')
  .tags('fields', 'field-names', 'proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (let i = 1; i < trace.length; i++) {
        // forwarded = request the proxy sent onward; received = request it got.
        const forwarded = trace[i - 1];
        const received = trace[i];
        if (
          !forwarded ||
          !received ||
          forwarded.request.meta.role !== 'proxy'
        ) {
          continue;
        }
        const excepted = new Set([
          ...DROPPABLE,
          ...connectionOptionNames(
            getHeader(received.request.data.headers, 'connection'),
          ),
        ]);
        const dropped = Object.keys(received.request.data.headers ?? {})
          .map((name) => name.toLowerCase())
          .filter(
            (name) =>
              !excepted.has(name) &&
              getHeader(forwarded.request.data.headers, name) === undefined,
          );
        if (dropped.length > 0) {
          results.push({
            location,
            violation: {
              message: `A proxy did not forward header field(s) (${dropped.join(', ')}) present on the received request. Unless configured to block them, a proxy must forward unrecognized fields.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
