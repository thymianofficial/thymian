import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { forwardingHops, parseMaxForwards } from '../../utils/forwarding.js';

export default httpRule(
  'rfc9110/intermediary-must-check-and-update-max-forwards',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'Each intermediary that receives a TRACE or OPTIONS request containing a Max-Forwards header field MUST check and update its value prior to forwarding the request. The Max-Forwards mechanism limits the number of times a request can be forwarded.',
  )
  .summary('Intermediary MUST check and update Max-Forwards value.')
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
        // received === 0 is reported by must-not-forward-when-max-forwards-is-zero;
        // an absent or insufficiently-decremented forwarded value (received > 0)
        // is reported by must-generate-updated-max-forwards-when-forwarding. This
        // rule flags only a forwarded value that is present but not decremented.
        if (receivedValue === undefined || receivedValue <= 0) {
          continue;
        }
        if (forwardedValue !== undefined && forwardedValue >= receivedValue) {
          results.push({
            location,
            violation: {
              message: `An intermediary forwarded a ${method} request without decrementing Max-Forwards (received ${receivedValue}, forwarded ${forwardedValue}).`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
