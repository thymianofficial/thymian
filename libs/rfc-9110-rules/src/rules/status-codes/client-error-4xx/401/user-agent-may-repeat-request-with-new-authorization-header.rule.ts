import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-repeat-request-with-new-authorization-header',
)
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .summary(
    'The user agent MAY repeat the request with a new or replaced Authorization header field.',
  )
  .description(
    'If the request included authentication credentials, then the 401 response indicates that authorization has been refused for those credentials. The user agent MAY repeat the request with a new or replaced Authorization header field. ',
  )
  .appliesTo('user-agent')
  .done();
