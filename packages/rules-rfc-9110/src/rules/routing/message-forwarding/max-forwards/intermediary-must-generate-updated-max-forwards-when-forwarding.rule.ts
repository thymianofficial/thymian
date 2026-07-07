import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { parseMaxForwards } from '../../utils/forwarding.js';

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
      for (let i = 1; i < trace.length; i++) {
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
        const forwardedValue = parseMaxForwards(
          getHeader(forwarded.request.data.headers, 'max-forwards'),
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
              message: `An intermediary forwarding a ${method} request MUST generate a Max-Forwards no greater than the received value minus one (received ${receivedValue}, forwarded ${forwardedValue ?? 'none'}).`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
