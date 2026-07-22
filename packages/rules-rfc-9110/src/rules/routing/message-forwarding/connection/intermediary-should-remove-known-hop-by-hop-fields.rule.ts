import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { equalHeaderValues, forwardingHops } from '../../utils/forwarding.js';

const KNOWN_HOP_BY_HOP = [
  'proxy-connection',
  'keep-alive',
  'te',
  'transfer-encoding',
  'upgrade',
];

export default httpRule(
  'rfc9110/intermediary-should-remove-known-hop-by-hop-fields',
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    "Intermediaries SHOULD remove or replace fields that are known to require removal before forwarding, whether or not they appear as a connection-option, after applying those fields' semantics. This includes but is not limited to: Proxy-Connection, Keep-Alive, TE, Transfer-Encoding, and Upgrade.",
  )
  .summary('Intermediary SHOULD remove known hop-by-hop fields.')
  .appliesTo('intermediary')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (const { inbound, outbound } of forwardingHops(trace)) {
        // The rule is SHOULD "remove or replace": a field whose value changed
        // across the hop was replaced and is compliant. Only a field forwarded
        // unchanged (present on both legs with an equal value) is flagged.
        const forwardedUnchanged = KNOWN_HOP_BY_HOP.filter((name) => {
          const received = getHeader(inbound.request.data.headers, name);
          const forwarded = getHeader(outbound.request.data.headers, name);
          return (
            received !== undefined &&
            forwarded !== undefined &&
            equalHeaderValues(received, forwarded)
          );
        });
        if (forwardedUnchanged.length > 0) {
          results.push({
            location,
            violation: {
              message: `An intermediary forwarded known hop-by-hop header field(s) (${forwardedUnchanged.join(', ')}) unchanged instead of removing or replacing them before forwarding.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
