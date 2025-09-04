import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-may-repeat-request-with-new-proxy-authenticate-header-for-407-response'
)
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-407-proxy-authentication-re'
  )
  .description(
    'The client MAY repeat the request with a new or replaced Proxy-Authorization header field.'
  )
  .appliesTo('client')
  .done();
