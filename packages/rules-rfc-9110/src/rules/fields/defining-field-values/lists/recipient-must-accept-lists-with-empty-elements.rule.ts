import { httpRule } from '@thymian/core';

// TODO: Implement ABNF validation for #rule recipient syntax
// Requires accepting lists with empty elements per recipient syntax:
//   #element => [ element ] *( OWS "," OWS [ element ] )
export default httpRule(
  'rfc9110/recipient-must-accept-lists-with-empty-elements',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.1')
  .description(
    'In other words, a recipient MUST accept lists that satisfy the following syntax: #element => [ element ] *( OWS "," OWS [ element ] )',
  )
  .summary(
    'Recipient MUST accept lists with empty elements in the specified syntax.',
  )
  .tags('fields', 'lists', 'parsing')
  .done();
