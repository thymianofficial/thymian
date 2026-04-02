import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-reject-connect-request-with-empty-or-invalid-port-number',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A server MUST reject a CONNECT request that targets an empty or invalid port number, typically by responding with a 400 (Bad Request) status code.',
  )
  .appliesTo('server')
  .done();
