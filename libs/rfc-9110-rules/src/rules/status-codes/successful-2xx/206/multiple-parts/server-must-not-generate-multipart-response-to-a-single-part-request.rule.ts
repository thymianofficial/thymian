import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-not-generate-multipart-response-to-a-single-part-request'
)
  .severity('error')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'A server MUST NOT generate a multipart response to a request for a single range, since a client that does not request multiple parts might not support multipart responses.'
  )
  .appliesTo('server')
  .done();
