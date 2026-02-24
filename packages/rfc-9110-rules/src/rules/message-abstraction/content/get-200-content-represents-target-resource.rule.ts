import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/get-200-content-represents-target-resource')
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.2')
  .description(
    'If the request method is GET and the response status code is 200 (OK), the content is a representation of the target resource.',
  )
  .summary('GET 200 response content represents the target resource.')
  .done();
