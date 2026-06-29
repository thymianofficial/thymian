import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/new-fields-should-limit-values-to-visible-ascii',
)
  .severity('warn')
  // Informational: this SHOULD is directed at *specification authors* defining
  // new header fields ("Specifications for newly defined fields SHOULD limit
  // their values to ..."), not at any HTTP message participant. It is a
  // design-time recommendation about future field definitions; it has no
  // observable condition in the request/response traffic or OpenAPI
  // description that Thymian can lint, test, or analyze. Recorded for
  // documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'Specifications for newly defined fields SHOULD limit their values to visible US-ASCII octets (VCHAR), SP, and HTAB.',
  )
  .summary(
    'Specifications for new fields SHOULD limit values to visible ASCII, SP, and HTAB.',
  )
  .done();
