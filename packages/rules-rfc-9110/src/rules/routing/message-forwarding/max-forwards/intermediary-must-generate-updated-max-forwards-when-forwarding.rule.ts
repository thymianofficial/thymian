import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { forwardingHops, parseMaxForwards } from '../../utils/forwarding.js';

export default httpRule(
  'rfc9110/intermediary-must-generate-updated-max-forwards-when-forwarding',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    "If the received Max-Forwards value is greater than zero, the intermediary MUST generate an updated Max-Forwards field in the forwarded message with a field value that is the lesser of a) the received value decremented by one (1) or b) the recipient's maximum supported value for Max-Forwards.",
  )
  .summary('Intermediary MUST generate updated Max-Forwards when forwarding.')
  .appliesTo('intermediary')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (const { inbound, outbound } of forwardingHops(trace)) {
        const method = inbound.request.data.method.toUpperCase();
        if (method !== 'TRACE' && method !== 'OPTIONS') {
          continue;
        }
        const receivedValue = parseMaxForwards(
          getHeader(inbound.request.data.headers, 'max-forwards'),
        );
        const forwardedValue = parseMaxForwards(
          getHeader(outbound.request.data.headers, 'max-forwards'),
        );
        if (receivedValue === undefined || receivedValue <= 0) {
          continue;
        }
        if (
          forwardedValue === undefined ||
          forwardedValue > receivedValue - 1
        ) {
          results.push({
            location,
            violation: {
              message: `An intermediary forwarded a ${method} request with Max-Forwards ${forwardedValue ?? 'absent'} although the received value was ${receivedValue} (expected at most ${receivedValue - 1}).`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
