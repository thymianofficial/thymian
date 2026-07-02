import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-may-repeat-request-with-new-proxy-authenticate-header-for-407-response',
)
  .severity('hint')
  // Permissive MAY describing an internal client retry decision; no
  // non-conformant condition to observe.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-407-proxy-authentication-re',
  )
  .description(
    'The client MAY repeat the request with a new or replaced Proxy-Authorization header field.',
  )
  .appliesTo('client')
  .done();
