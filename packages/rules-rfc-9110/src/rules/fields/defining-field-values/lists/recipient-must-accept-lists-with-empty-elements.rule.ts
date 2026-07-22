import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-accept-lists-with-empty-elements',
)
  .severity('error')
  // Whether a recipient accepts a list containing empty elements is internal
  // parsing behaviour with no observable signal, and Thymian cannot inject such
  // a list into the peer's inbound path to probe it.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.1')
  .description(
    'In other words, a recipient MUST accept lists that satisfy the following syntax: #element => [ element ] *( OWS "," OWS [ element ] )',
  )
  .summary(
    'Recipient MUST accept lists with empty elements in the specified syntax.',
  )
  .done();
