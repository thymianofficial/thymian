import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/recipient-must-ignore-if-unmodified-since-header-if-no-date-available',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'A recipient MUST ignore the If-Unmodified-Since header field if the resource does not have a modification date available.',
  )
  .tags('conditional-requests', 'if-modified-since', 'evaluation')
  .done();
