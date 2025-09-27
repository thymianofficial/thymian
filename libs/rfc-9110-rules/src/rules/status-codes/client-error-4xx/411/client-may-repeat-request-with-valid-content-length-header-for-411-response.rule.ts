import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-may-repeat-request-with-valid-content-length-header-for-411-response',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-411-length-required')
  .description(
    'The client MAY repeat the request if it adds a valid Content-Length header field containing the length of the request content.',
  )
  .appliesTo('client')
  .done();
