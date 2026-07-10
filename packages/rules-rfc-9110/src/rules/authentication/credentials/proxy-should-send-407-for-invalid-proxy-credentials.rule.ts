import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-should-send-407-for-invalid-proxy-credentials',
)
  .severity('warn')
  // The SHOULD is conditioned on the proxy requiring authentication and the
  // request having omitted, invalid, or partial proxy credentials. Whether a
  // proxy requires authentication and whether supplied proxy credentials are
  // valid is proxy-internal ground truth not observable from the wire, so there
  // is no reliable non-conformant condition to detect. (It is also a proxy
  // behavior; Thymian is not the proxy, so `test` is not applicable either.)
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-credentials')
  .description(
    'Upon receipt of a request that omits proxy credentials or contains invalid or partial proxy credentials, a proxy that requires authentication SHOULD generate a 407 (Proxy Authentication Required) response with a Proxy-Authenticate header field.',
  )
  .appliesTo('proxy')
  .done();
