import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-generate-multipart-byteranges-content-for-multi-part-206-response'
)
  .severity('error')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'If multiple parts are being transferred, the server generating the 206 response MUST generate "multipart/byteranges" content and a Content-Type header field containing the "multipart/byteranges" media type and its required boundary parameter.'
  )
  .appliesTo('server')
  .done();
