import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { parseMaxForwards } from '../../utils/forwarding.js';

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
        if (receivedValue === undefined) {
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
