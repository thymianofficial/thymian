import { httpRule } from '@thymian/core';

// Informational (outcome 2): permissive "MAY" describing how a recipient MAY
// internally model received trailers. It is internal recipient processing with
// no observable non-conformant condition in any transaction.
export default httpRule(
  'rfc9110/recipient-may-treat-the-set-of-received-trailer-fields-as-name-value-pairs',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.2')
  .description(
    'At the end of a message, a recipient MAY treat the set of received trailer fields as a data structure of name/value pairs, similar to (but separate from) the header fields. Additional processing expectations, if any, can be defined within the field specification for a field intended for use in trailers.',
  )
  .summary(
    'Recipient MAY treat the set of received trailer fields as a data structure of name/value pairs.',
  )
  .done();
