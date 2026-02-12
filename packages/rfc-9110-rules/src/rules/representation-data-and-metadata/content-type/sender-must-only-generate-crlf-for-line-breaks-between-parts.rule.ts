import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/sender-must-only-generate-crlf-for-line-breaks-between-parts',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.3')
  .description(
    'A sender MUST generate only CRLF to represent line breaks between body parts.',
  )
  .done();
