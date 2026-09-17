import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-repeat-request-with-new-proxy-authenticate-header-for-407-response',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A MAY describing an internal client retry decision; no non-conformant condition to observe.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-407-proxy-authentication-re',
  )
  .description(
    'The client MAY repeat the request with a new or replaced Proxy-Authorization header field.',
  )
  .appliesTo('client')
  .done();
