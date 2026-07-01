import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/new-fields-should-limit-values-to-visible-ascii',
)
  .severity('warn')
  // Informational (not a runtime property): this SHOULD constrains authors of
  // *new field specifications*, not messages on the wire. There is no HTTP
  // transaction that can conform to or violate it, so it is not observable.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'Specifications for newly defined fields SHOULD limit their values to visible US-ASCII octets (VCHAR), SP, and HTAB.',
  )
  .summary(
    'Specifications for new fields SHOULD limit values to visible ASCII, SP, and HTAB.',
  )
  .done();
