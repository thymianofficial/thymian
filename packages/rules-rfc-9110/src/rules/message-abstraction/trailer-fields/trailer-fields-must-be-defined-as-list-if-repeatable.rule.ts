import { httpRule } from '@thymian/core';

// Informational (outcome 2): this MUST is a constraint on how a *field is
// defined* in its specification (repeatable trailer fields MUST be defined as
// list-based), not on the content of any individual message. There is no
// per-transaction observation — and no OpenAPI modeling of trailer-field
// definitions — that the rule framework can use to detect a violation.
export default httpRule(
  'rfc9110/trailer-fields-must-be-defined-as-list-if-repeatable',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.2')
  .description(
    'Like header fields, trailer fields with the same name are processed in the order received; multiple trailer field lines with the same name have the equivalent semantics as appending the multiple values as a list of members. Trailer fields that might be generated more than once during a message MUST be defined as a list-based field even if each member value is only processed once per field line received.',
  )
  .summary(
    'Trailer fields that can repeat MUST be defined as list-based fields.',
  )
  .done();
