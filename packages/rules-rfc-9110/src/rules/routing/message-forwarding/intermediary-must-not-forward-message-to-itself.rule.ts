import { getHeader, httpRule, type RuleFnResult } from '@thymian/core';

import { headerValues } from '../utils/forwarding.js';

export default httpRule(
  'rfc9110/intermediary-must-not-forward-message-to-itself',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-message-forwarding')
  .description(
    'An intermediary MUST NOT forward a message to itself unless it is protected from an infinite request loop. In general, an intermediary ought to recognize its own server names, including any aliases, local variations, or literal IP addresses, and respond to such requests directly.',
  )
  .summary(
    'Intermediary MUST NOT forward message to itself without loop protection.',
  )
  .appliesTo('intermediary')
  .rule((ctx) =>
    ctx.validateCapturedHttpTraces((trace, location) => {
      const results: RuleFnResult[] = [];
      for (const transaction of trace) {
        if (transaction.request.meta.role !== 'intermediary') {
          continue;
        }
        // A received-by identifier repeated in the Via chain means the message
        // passed through the same intermediary twice - a forwarding loop.
        const receivedBy = headerValues(
          getHeader(transaction.request.data.headers, 'via'),
        )
          .flatMap((entry) => entry.split(','))
          .map((entry) => entry.trim().split(/\s+/)[1]?.toLowerCase())
          .filter((entry): entry is string => Boolean(entry));
        const looped = receivedBy.some(
          (entry, index) => receivedBy.indexOf(entry) !== index,
        );
        if (looped) {
          results.push({
            location,
            violation: {
              message:
                'A message was forwarded through an intermediary already present in its own Via chain (duplicate received-by), indicating a forwarding loop.',
            },
            findings: [],
          });
        }
      }
      return results;
    }),
  )
  .done();
