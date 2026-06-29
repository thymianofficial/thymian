import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-generate-content-encoding-header-if-encodings-applied',
)
  .severity('error')
  // Informational (outcome 2): detecting a violation means knowing that a
  // content coding was actually applied to the body WITHOUT a corresponding
  // Content-Encoding header. That requires inspecting and sniffing the raw
  // representation bytes (e.g. recognizing a gzip magic number on a body that
  // declares no Content-Encoding), which the rule framework does not expose —
  // the contexts surface header names/values and body presence, not body
  // content. With only headers visible, a missing Content-Encoding is
  // indistinguishable from an unencoded body, so there is no observable
  // non-conformant condition. (If body-content sniffing is added in future,
  // this could become an active analyze rule.)
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `If one or more encodings have been applied to a representation, the sender that applied the encodings MUST generate a Content-Encoding header field that lists the content codings in the order in which they were applied.`,
  )
  .done();
