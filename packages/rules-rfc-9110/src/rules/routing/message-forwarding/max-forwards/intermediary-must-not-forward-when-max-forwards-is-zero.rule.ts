import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { forwardingHops, parseMaxForwards } from '../../utils/forwarding.js';

export default httpRule(
  'rfc9110/intermediary-must-not-forward-when-max-forwards-is-zero',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'If the received Max-Forwards value is zero (0), the intermediary MUST NOT forward the request; instead, the intermediary MUST respond as the final recipient. This prevents infinite forwarding loops in TRACE and OPTIONS requests.',
  )
  .summary('Intermediary MUST NOT forward request when Max-Forwards is zero.')
  .appliesTo('intermediary')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      // The existence of an outbound leg means the intermediary forwarded the
      // request; if the inbound Max-Forwards was 0, forwarding is forbidden.
      for (const { inbound } of forwardingHops(trace)) {
        const method = inbound.request.data.method.toUpperCase();
        if (method !== 'TRACE' && method !== 'OPTIONS') {
          continue;
        }
        const receivedValue = parseMaxForwards(
          getHeader(inbound.request.data.headers, 'max-forwards'),
        );
        if (receivedValue === 0) {
          results.push({
            location,
            violation: {
              message: `An intermediary forwarded a ${method} request that arrived with Max-Forwards: 0 instead of responding as the final recipient.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
