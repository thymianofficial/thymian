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
        const optionNames = connectionOptionNames(
          getHeader(inbound.request.data.headers, 'connection'),
        );

        // 1. Each header field named by a received connection-option must be
        //    removed; it must not survive on the request forwarded onward.
        const survivors = optionNames.filter(
          (name) =>
            name !== 'close' &&
            getHeader(outbound.request.data.headers, name) !== undefined,
        );

        // 2. The Connection header field itself must be removed or replaced
        //    with the intermediary's own control options: the received
        //    connection-option names must not reappear in the forwarded
        //    Connection header.
        const forwardedOptions = connectionOptionNames(
          getHeader(outbound.request.data.headers, 'connection'),
        );
        const relisted = optionNames.filter(
          (name) => name !== 'close' && forwardedOptions.includes(name),
        );

        const problems: string[] = [];
        if (survivors.length > 0) {
          problems.push(
            `forwarded connection-specific header field(s) (${survivors.join(', ')}) named in the received Connection header field`,
          );
        }
        if (relisted.length > 0) {
          problems.push(
            `forwarded the received Connection header field without removing or replacing it (it still lists connection-option(s) ${relisted.join(', ')})`,
          );
        }
        if (problems.length > 0) {
          results.push({
            location,
            violation: {
              message: `An intermediary ${problems.join(' and ')}.`,
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
