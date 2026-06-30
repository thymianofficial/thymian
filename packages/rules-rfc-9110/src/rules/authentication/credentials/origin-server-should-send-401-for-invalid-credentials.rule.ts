import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-401-for-invalid-credentials',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-credentials')
  .description(
    'Upon receipt of a request for a protected resource that omits credentials, contains invalid credentials, or partial credentials, an origin server SHOULD send a 401 (Unauthorized) response that contains a WWW-Authenticate header field.',
  )
  .appliesTo('origin server')
  .done();
