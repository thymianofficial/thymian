import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-repeat-request-with-new-proxy-authenticate-header-for-407-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A client that takes this up repeats the request with a Proxy-Authorization field the rejected one lacked, or with a replaced value, which a captured trace carries as a later transaction. The hint — a 407 that was never followed by a repeat carrying proxy credentials — is not written yet.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-407-proxy-authentication-re',
  )
  .description(
    'The client MAY repeat the request with a new or replaced Proxy-Authorization header field.',
  )
  .appliesTo('client')
  .done();
