import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-should-send-407-for-invalid-proxy-credentials',
)
  .severity('warn')
  // TODO: implement rule function to validate 407 response with Proxy-Authenticate header.
  // - test: when testing through a proxy that requires authentication, verify the proxy
  //   responds with 407 and includes a Proxy-Authenticate header field.
  // - analyze: inspect recorded traffic for proxy authentication failures and verify
  //   407 status with Proxy-Authenticate is present.
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-credentials')
  .description(
    'Upon receipt of a request that omits proxy credentials or contains invalid or partial proxy credentials, a proxy that requires authentication SHOULD generate a 407 (Proxy Authentication Required) response with a Proxy-Authenticate header field.',
  )
  .appliesTo('proxy')
  .done();
