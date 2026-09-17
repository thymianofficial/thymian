import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- conditional-header applicability scoping, not a concern-axis topic
export default httpRule(
  'rfc9110/recipient-must-ignore-if-modified-since-header-if-no-date-available',
)
  .severity('error')
  .type(
    'informational',
    'only-origin-knows',
    'Whether a resource has a modification date available is internal server state not exposed on the wire, so whether ignoring If-Modified-Since was required cannot be determined externally.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'A recipient MUST ignore the If-Modified-Since header field if the resource does not have a modification date available.',
  )
  .summary(
    'Recipient MUST ignore If-Modified-Since when the resource has no modification date available.',
  )
  .done();
