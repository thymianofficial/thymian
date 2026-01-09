import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-must-ignore-100-continue-in-http-1.0')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that receives a 100-continue expectation in an HTTP/1.0 request MUST ignore that expectation.',
  )
  .appliesTo('server')
  .done();
