import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/get-206-content-is-partial-representation')
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.2')
  .description(
    'If the request method is GET and the response status code is 206 (Partial Content), the content is one or more parts of a representation of the target resource.',
  )
  .summary('GET 206 response content contains partial representation.')
  .done();
