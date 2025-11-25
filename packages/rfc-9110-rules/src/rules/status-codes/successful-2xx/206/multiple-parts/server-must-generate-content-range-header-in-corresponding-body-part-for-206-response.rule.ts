import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-generate-content-range-header-in-corresponding-body-part-for-206-response',
)
  .severity('error')
  .type('informational')
  .description(
    'Within the header area of each body part in the multipart content, the server MUST generate a Content-Range header field corresponding to the range being enclosed in that body part.',
  )
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .appliesTo('server')
  .done();
