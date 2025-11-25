import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-must-understand-class-of-any-status-code',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-status-codes')
  .description(
    'HTTP status codes are extensible. A client is not required to understand the meaning of all registered status codes, though such understanding is obviously desirable. However, a client MUST understand the class of any status code, as indicated by the first digit, and treat an unrecognized status code as being equivalent to the x00 status code of that class.',
  )
  .summary('Clients MUST understand the class of any status code.')
  .appliesTo('client')
  .done();
