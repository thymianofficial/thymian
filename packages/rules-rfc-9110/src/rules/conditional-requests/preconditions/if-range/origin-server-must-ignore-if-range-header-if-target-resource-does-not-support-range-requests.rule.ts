import { httpRule } from '@thymian/core';

/**
 * The trigger condition — "the target resource does not support Range requests"
 * — is internal server capability that is not reliably exposed on the wire (a
 * resource can omit Accept-Ranges yet still be range-capable, and absence of the
 * header is not a definitive signal). Without a dependable indicator that ranges
 * are unsupported, the framework cannot decide whether ignoring If-Range was
 * required. The neighbouring, unconditionally-decidable case (If-Range with no
 * Range header at all) is handled by `server-must-ignore-if-range-without-range`.
 */
export default httpRule(
  'rfc9110/origin-server-must-ignore-if-range-header-if-target-resource-does-not-support-range-requests',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'An origin server MUST ignore an If-Range header field received in a request for a target resource that does not support Range requests.',
  )
  .summary(
    'Origin server MUST ignore If-Range when the target resource does not support Range requests.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-range', 'evaluation')
  .done();
