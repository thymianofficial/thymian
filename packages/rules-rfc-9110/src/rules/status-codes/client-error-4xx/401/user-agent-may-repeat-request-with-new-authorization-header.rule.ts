import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-repeat-request-with-new-authorization-header',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A MAY describing an internal user-agent retry decision (whether to repeat a 401 with new/replaced credentials). There is no non-conformant condition to observe: retrying is optional and not retrying is equally valid.',
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
