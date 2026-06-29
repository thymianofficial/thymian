import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-not-send-accept-language-without-user-control',
)
  .severity('hint')
  // Informational: the precondition that triggers this MUST NOT — that the user
  // agent "does not provide user control" over linguistic preference — is
  // internal user-agent state. It cannot be derived from the API description, a
  // live response, or recorded traffic: observing an Accept-Language header
  // says nothing about whether the agent exposes user control over it.
  // Genuinely unobservable, so it is informational rather than a declared-but-
  // empty `analytics` rule.
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
