import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/recipient-must-ignore-if-modified-since-header-if-no-date-available',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'A recipient MUST ignore the If-Modified-Since header field if the resource does not have a modification date available.',
  )
  .tags('conditional-requests', 'if-modified-since', 'evaluation')
  .done();
