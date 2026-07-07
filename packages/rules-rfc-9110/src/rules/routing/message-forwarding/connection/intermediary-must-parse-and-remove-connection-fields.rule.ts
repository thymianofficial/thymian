import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { connectionOptionNames } from '../../utils/forwarding.js';

export default httpRule(
  'rfc9110/intermediary-must-parse-and-remove-connection-fields',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    "Intermediaries MUST parse a received Connection header field before a message is forwarded and, for each connection-option in this field, remove any header or trailer field(s) from the message with the same name as the connection-option, and then remove the Connection header field itself (or replace it with the intermediary's own control options for the forwarded message).",
  )
  .summary(
    'Intermediary MUST parse and remove Connection fields before forwarding.',
  )
  .appliesTo('intermediary')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (let i = 1; i < trace.length; i++) {
        // forwarded = message as the intermediary sent it onward;
        // received = message as the intermediary received it.
        const forwarded = trace[i - 1];
        const received = trace[i];
        if (
          !forwarded ||
          !received ||
          forwarded.request.meta.role !== 'intermediary'
        ) {
          continue;
        }
        const optionNames = connectionOptionNames(
          getHeader(received.request.data.headers, 'connection'),
        );
        const survivors = optionNames.filter(
          (name) =>
            name !== 'close' &&
            getHeader(forwarded.request.data.headers, name) !== undefined,
        );
        if (survivors.length > 0) {
          results.push({
            location,
            violation: {
              message: `An intermediary forwarded connection-specific header field(s) (${survivors.join(', ')}) named in the received Connection header field. It MUST remove them before forwarding.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
