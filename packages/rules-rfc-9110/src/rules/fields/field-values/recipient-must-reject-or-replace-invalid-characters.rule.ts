import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-reject-or-replace-invalid-characters',
)
  .severity('error')
  // Exercising this rule requires transmitting a field value containing raw CR,
  // LF, or NUL octets, which the HTTP client cannot construct — such octets are
  // stripped or rejected at the transport/serialization layer, so Thymian can
  // never send the malformed input needed to probe the recipient. Even if it
  // could, a conformant recipient that rejects the message or silently replaces
  // those octets with SP leaves no distinguishable observable signal in the
  // response.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'Field values containing CR, LF, or NUL characters are invalid and dangerous, due to the varying ways that implementations might parse and interpret those characters; a recipient of CR, LF, or NUL within a field value MUST either reject the message or replace each of those characters with SP before further processing or forwarding of that message.',
  )
  .summary(
    'Recipient MUST either reject messages or replace CR, LF, or NUL characters with SP in field values.',
  )
  .done();
