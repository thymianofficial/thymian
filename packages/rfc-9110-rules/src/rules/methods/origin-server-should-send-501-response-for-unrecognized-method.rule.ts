import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-send-501-response-for-unrecognized-method',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'An origin server that receives a request method that is unrecognized or not implemented SHOULD respond with the 501 (Not Implemented) status code.',
  )
  .appliesTo('origin server')
  .done();
