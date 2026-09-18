import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-repeat-request-with-new-authorization-header',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up sends the request again with a new or replaced Authorization value, which a captured trace carries as a later transaction against the same target. The hint — a 401 that was never followed by a repeat carrying different credentials — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .summary(
    'The user agent MAY repeat the request with a new or replaced Authorization header field.',
  )
  .description(
    'If the request included authentication credentials, then the 401 response indicates that authorization has been refused for those credentials. The user agent MAY repeat the request with a new or replaced Authorization header field. ',
  )
  .appliesTo('user-agent')
  .done();
