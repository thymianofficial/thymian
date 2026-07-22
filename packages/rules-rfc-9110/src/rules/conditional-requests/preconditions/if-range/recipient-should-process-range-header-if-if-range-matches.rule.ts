import { httpRule } from '@thymian/core';

/**
 * This is the permissive "otherwise" half of the If-Range rule: when the
 * condition matches, the recipient SHOULD process the Range. It is a SHOULD, and
 * declining to serve a partial response is legitimate (e.g. the resource does
 * not actually support ranges, or the server chooses to return the full
 * representation), so a non-206 outcome is not a violation. The complementary
 * hard requirement — the recipient MUST ignore the Range and not return 206 when
 * If-Range is false — is actively tested by
 * `recipient-must-ignore-range-when-if-range-false`.
 */
export default httpRule(
  'rfc9110/recipient-should-process-range-header-if-if-range-matches',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A recipient of an If-Range header field MUST ignore the Range header field if the If-Range condition evaluates to false. Otherwise, the recipient SHOULD process the Range header field as requested.',
  )
  .summary(
    'Recipient SHOULD process the Range header field when the If-Range condition matches.',
  )
  .done();
