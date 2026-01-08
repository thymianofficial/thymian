import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-should-send-407-for-invalid-proxy-credentials',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-credentials')
  .description(
    'Upon receipt of a request that omits proxy credentials or contains invalid or partial proxy credentials, a proxy that requires authentication SHOULD generate a 407 (Proxy Authentication Required) response with a Proxy-Authenticate header field.',
  )
  .appliesTo('proxy')
  .done();
