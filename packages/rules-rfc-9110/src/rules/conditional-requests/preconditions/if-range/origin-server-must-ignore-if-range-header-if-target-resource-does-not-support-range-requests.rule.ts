import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- conditional-header applicability scoping, not a concern-axis topic
export default httpRule(
  'rfc9110/origin-server-must-ignore-if-range-header-if-target-resource-does-not-support-range-requests',
)
  .severity('error')
  .type(
    'informational',
    'only-origin-knows',
    'Whether the target resource supports Range requests is internal server capability not reliably exposed on the wire — a range-capable resource can still omit Accept-Ranges, so its absence is not a definitive signal.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'An origin server MUST ignore an If-Range header field received in a request for a target resource that does not support Range requests.',
  )
  .summary(
    'Origin server MUST ignore If-Range when the target resource does not support Range requests.',
  )
  .explanation(
    'The neighbouring, unconditionally-decidable case (If-Range with no Range header at all) is handled by server-must-ignore-if-range-without-range.',
  )
  .appliesTo('origin server')
  .done();
