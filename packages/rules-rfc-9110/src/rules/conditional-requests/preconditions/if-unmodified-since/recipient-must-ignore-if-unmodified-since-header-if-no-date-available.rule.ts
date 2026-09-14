import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- conditional-header applicability scoping, not a concern-axis topic
export default httpRule(
  'rfc9110/recipient-must-ignore-if-unmodified-since-header-if-no-date-available',
)
  .severity('error')
  .type(
    'informational',
    'origin-internal-ground-truth',
    'Whether a resource has a modification date available is internal server state not exposed on the wire.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'A recipient MUST ignore the If-Unmodified-Since header field if the resource does not have a modification date available.',
  )
  .summary(
    'Recipient MUST ignore If-Unmodified-Since when the resource has no modification date available.',
  )
  .done();
