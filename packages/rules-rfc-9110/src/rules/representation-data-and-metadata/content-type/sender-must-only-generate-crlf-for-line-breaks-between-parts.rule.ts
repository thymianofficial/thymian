import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-only-generate-crlf-for-line-breaks-between-parts',
)
  .severity('error')
  // Informational (outcome 2): this MUST governs the raw byte sequence used for
  // line breaks BETWEEN multipart body parts (CRLF, not bare CR or LF).
  // Verifying it requires inspecting the raw body bytes of a multipart payload,
  // which the rule framework does not expose (contexts surface header
  // names/values, media type, and body presence — not body content). With no
  // access to the body octets there is no observable non-conformant condition.
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.3')
  .description(
    'A sender MUST generate only CRLF to represent line breaks between body parts.',
  )
  .done();
