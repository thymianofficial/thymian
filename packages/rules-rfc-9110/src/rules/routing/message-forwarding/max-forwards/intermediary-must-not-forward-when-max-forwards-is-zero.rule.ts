import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { parseMaxForwards } from '../../utils/forwarding.js';

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
      for (let i = 1; i < trace.length; i++) {
        // A forwarded leg emitted by the intermediary paired with the request
        // it received: if the received Max-Forwards was 0, forwarding is forbidden.
        const forwarded = trace[i - 1];
        const received = trace[i];
        if (
          !forwarded ||
          !received ||
          forwarded.request.meta.role !== 'intermediary'
        ) {
          continue;
        }
        const method = received.request.data.method.toUpperCase();
        if (method !== 'TRACE' && method !== 'OPTIONS') {
          continue;
        }
        const receivedValue = parseMaxForwards(
          getHeader(received.request.data.headers, 'max-forwards'),
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
