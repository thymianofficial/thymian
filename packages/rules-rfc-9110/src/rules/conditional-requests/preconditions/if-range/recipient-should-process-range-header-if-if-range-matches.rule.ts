import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-process-range-header-if-if-range-matches',
)
  .severity('warn')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A recipient of an If-Range header field MUST ignore the Range header field if the If-Range condition evaluates to false. Otherwise, the recipient SHOULD process the Range header field as requested.',
  )
  .appliesTo('server')
  .tags('conditional-requests', 'if-range', 'evaluation')
  // TODO: Implement test rule that sends a Range request with a matching If-Range ETag
  // (from a prior response) and verifies the server returns 206 Partial Content.
  // TODO: Implement analytics rule that checks recorded traffic for transactions where
  // a matching If-Range was sent with a Range header but the server did not respond with 206.
  .done();
