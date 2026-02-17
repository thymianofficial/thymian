import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-must-ignore-range-header-with-unknown-range-unit',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'An origin server MUST ignore a Range header field that contains a range unit it does not understand.',
  )
  .appliesTo('origin server')
  .done();
