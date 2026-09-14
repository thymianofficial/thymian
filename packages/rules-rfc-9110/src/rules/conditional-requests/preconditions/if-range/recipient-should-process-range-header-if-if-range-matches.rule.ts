import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- conditional-header applicability scoping, not a concern-axis topic
export default httpRule(
  'rfc9110/recipient-should-process-range-header-if-if-range-matches',
)
  .severity('warn')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A SHOULD: declining to serve a partial response when the condition matches is legitimate (the resource may not truly support ranges, or the server may choose to return the full representation), so a non-206 outcome is not itself a violation.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A recipient of an If-Range header field MUST ignore the Range header field if the If-Range condition evaluates to false. Otherwise, the recipient SHOULD process the Range header field as requested.',
  )
  .summary(
    'Recipient SHOULD process the Range header field when the If-Range condition matches.',
  )
  .explanation(
    'The complementary hard requirement — ignore Range and do not return 206 when If-Range is false — is actively tested by recipient-must-ignore-range-when-if-range-false.',
  )
  .done();
