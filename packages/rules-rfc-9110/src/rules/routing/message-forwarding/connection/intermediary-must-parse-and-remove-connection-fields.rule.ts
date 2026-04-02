import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-parse-and-remove-connection-fields',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    "Intermediaries MUST parse a received Connection header field before a message is forwarded and, for each connection-option in this field, remove any header or trailer field(s) from the message with the same name as the connection-option, and then remove the Connection header field itself (or replace it with the intermediary's own control options for the forwarded message).",
  )
  .summary(
    'Intermediary MUST parse and remove Connection fields before forwarding.',
  )
  .appliesTo('intermediary')
  .done();
