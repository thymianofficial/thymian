import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-should-forward-206-with-unknown-range-unit',
)
  .severity('warn')
  // Informational (outcome 2): this SHOULD governs a proxy's internal forwarding
  // decision. Detecting non-forwarding would require correlating the proxy's
  // upstream and downstream messages AND knowing it did not "understand" the
  // range unit (internal capability) — neither is available from spec, a
  // generated test, or a typical HAR.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'If a 206 (Partial Content) response contains a Content-Range header field with a range unit that the recipient does not understand, a proxy that receives such a message SHOULD forward it downstream.',
  )
  .summary(
    'Proxy should forward 206 responses with unknown Content-Range units downstream.',
  )
  .appliesTo('proxy')
  .done();
