import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-generate-content-type-header-in-body-for-206-response',
)
  .severity('warn')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'If the selected representation would have had a Content-Type header field in a 200 (OK) response, the server SHOULD generate that same Content-Type header field in the header area of each body part.',
  )
  .appliesTo('server')
  .done();
