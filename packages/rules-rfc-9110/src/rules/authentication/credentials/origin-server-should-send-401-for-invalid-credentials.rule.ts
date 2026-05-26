import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-401-for-invalid-credentials',
)
  .severity('warn')
  // TODO: implement rule function to validate 401 response with WWW-Authenticate header.
  // - test: send a request without valid credentials to a protected endpoint and verify
  //   the server responds with 401 and includes a WWW-Authenticate header field.
  // - analyze: inspect recorded traffic for responses to unauthenticated requests and
  //   verify 401 status with WWW-Authenticate is present.
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-credentials')
  .description(
    'Upon receipt of a request for a protected resource that omits credentials, contains invalid credentials, or partial credentials, an origin server SHOULD send a 401 (Unauthorized) response that contains a WWW-Authenticate header field.',
  )
  .appliesTo('origin server')
  .done();
