import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-send-405-response-for-unallowed-method',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'An origin server that receives a request method that is recognized and implemented, but not allowed for the target resource, SHOULD respond with the 405 (Method Not Allowed) status code.',
  )
  .appliesTo('origin server')
  .done();
