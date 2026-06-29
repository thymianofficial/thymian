import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-accept-lists-with-empty-elements',
)
  .severity('error')
  // Informational: this MUST constrains the recipient's internal list parser
  // (it must not reject lists that carry empty elements). Acceptance is an
  // internal parser behavior with no observable effect on the request/response
  // Thymian can inspect — there is no on-the-wire signal distinguishing a
  // conformant from a non-conformant recipient. Recorded for documentation
  // only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.1')
  .description(
    'In other words, a recipient MUST accept lists that satisfy the following syntax: #element => [ element ] *( OWS "," OWS [ element ] )',
  )
  .summary(
    'Recipient MUST accept lists with empty elements in the specified syntax.',
  )
  .done();
