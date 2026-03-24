import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-process-range-header-if-if-range-matches',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A recipient of an If-Range header field MUST ignore the Range header field if the If-Range condition evaluates to false. Otherwise, the recipient SHOULD process the Range header field as requested.',
  )
  .tags('conditional-requests', 'if-range', 'evaluation')
  .done();
