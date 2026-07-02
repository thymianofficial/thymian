import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-401-for-invalid-credentials',
)
  .severity('warn')
  // The SHOULD is conditioned on the request having omitted, invalid, or
  // partial credentials for a *protected* resource. Whether supplied
  // credentials are valid, and whether a resource is protected, is
  // origin-server-internal ground truth that is not observable from the wire: a
  // 200 with credentials might be a public resource or a successful auth, and a
  // non-401 with bad credentials is indistinguishable from a request the server
  // simply did not treat as protected. Without that ground truth there is no
  // reliable non-conformant condition to detect.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-credentials')
  .description(
    'Upon receipt of a request for a protected resource that omits credentials, contains invalid credentials, or partial credentials, an origin server SHOULD send a 401 (Unauthorized) response that contains a WWW-Authenticate header field.',
  )
  .appliesTo('origin server')
  .done();
