import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-not-send-accept-language-without-user-control',
)
  .severity('error')
  // informational: whether a user agent provides user control over language
  // preferences is an implementation detail that cannot be determined from
  // HTTP traffic or API descriptions.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-language')
  .description(
    'Since intelligibility is highly dependent on the individual user, user agents need to allow user control over the linguistic preference (either through configuration of the user agent itself or by defaulting to a user controllable system setting). A user agent that does not provide such control to the user MUST NOT send an Accept-Language header field.',
  )
  .summary(
    'A user agent that does not provide such control to the user MUST NOT send an Accept-Language header field.',
  )
  .appliesTo('user-agent')
  .done();
