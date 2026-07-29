import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import {
  connectionOptionNames,
  forwardingHops,
} from '../../utils/forwarding.js';

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
      for (const { inbound, outbound } of forwardingHops(trace)) {
        // Each header field named by a received connection-option must be
        // removed before forwarding; it must not survive on the request the
        // intermediary forwarded onward. The Connection header field itself may
        // legitimately be replaced with the intermediary's own control options
        // for the next hop (which can reuse the same option names), so a
        // repeated option name is not by itself observable as a violation.
        const optionNames = connectionOptionNames(
          getHeader(inbound.request.data.headers, 'connection'),
        );
        const survivors = optionNames.filter(
          (name) =>
            name !== 'close' &&
            getHeader(outbound.request.data.headers, name) !== undefined,
        );
        if (survivors.length > 0) {
          results.push({
            location,
            violation: {
              message: `An intermediary forwarded connection-specific header field(s) (${survivors.join(', ')}) named in the received Connection header field.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
