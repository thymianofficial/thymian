import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-combine-field-lines-with-same-name',
)
  .severity('off')
  // Combining same-name field lines is an optional internal recipient choice
  // with no required outcome, and the recombined form is not re-emitted for
  // Thymian to observe.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3')
  .description(
    'A recipient MAY combine multiple field lines within a field section that have the same field name into one field line, without changing the semantics of the message, by appending each subsequent field line value to the initial field line value in order, separated by a comma (",") and optional whitespace (OWS, defined in Section 5.6.3).',
  )
  .summary(
    'Recipient MAY combine multiple field lines with the same name into one field line.',
  )
  .done();
