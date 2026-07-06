import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-not-send-accept-language-without-user-control',
)
  .severity('error')
  // The MUST NOT is conditioned on the user agent not providing user control
  // over the linguistic preference. Whether an agent exposes such control is
  // internal user-agent state that is not observable from the wire: seeing an
  // Accept-Language header says nothing about whether the user can influence
  // it. Without that ground truth there is no detectable non-conformant
  // condition in any context.
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
