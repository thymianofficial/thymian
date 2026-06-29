import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-parse-and-ignore-empty-list-elements',
)
  .severity('error')
  // Informational: this MUST governs the recipient's internal parsing (ignore
  // a reasonable number of empty list elements). It is an internal behavior of
  // the recipient that emits no observable difference in the messages Thymian
  // can lint, test, or analyze. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.1')
  .description(
    'A recipient MUST parse and ignore a reasonable number of empty list elements: enough to handle common mistakes by senders that merge values, but not so much that they could be used as a denial-of-service mechanism.',
  )
  .summary(
    'Recipient MUST parse and ignore a reasonable number of empty list elements.',
  )
  .done();
