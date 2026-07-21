import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { forwardingHops, parseMaxForwards } from '../../utils/forwarding.js';

export default httpRule(
  'rfc9110/intermediary-must-respond-as-final-recipient-when-max-forward-is-zero',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'If the received Max-Forwards value is zero (0), the intermediary MUST NOT forward the request; instead, the intermediary MUST respond as the final recipient. This prevents infinite forwarding loops in TRACE and OPTIONS requests.',
  )
  .summary(
    'Intermediary MUST respond as final recipient when Max-Forwards is zero.',
  )
  .appliesTo('intermediary')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      // Max-Forwards 0 means this intermediary is the final recipient and must
      // answer directly; an outbound leg at this hop means it did not.
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
              message: `An intermediary received a ${method} request with Max-Forwards: 0 but forwarded it instead of responding as the final recipient.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
