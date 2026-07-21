import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { forwardingHops } from '../../utils/forwarding.js';

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
        const notRemoved = KNOWN_HOP_BY_HOP.filter(
          (name) =>
            getHeader(inbound.request.data.headers, name) !== undefined &&
            getHeader(outbound.request.data.headers, name) !== undefined,
        );
        if (notRemoved.length > 0) {
          results.push({
            location,
            violation: {
              message: `An intermediary forwarded known hop-by-hop header field(s) (${notRemoved.join(', ')}) without removing them before forwarding.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
