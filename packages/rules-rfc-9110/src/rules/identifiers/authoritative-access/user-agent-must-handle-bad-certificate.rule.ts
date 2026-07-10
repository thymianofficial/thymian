import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/user-agent-must-handle-bad-certificate')
  .severity('error')
  // The user-agent's response to an invalid certificate (prompt the user or
  // terminate) happens at the TLS layer and in UI; it is not represented in
  // recorded HTTP messages.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    "If a certificate is not valid for the target URI's origin, a user agent MUST either obtain confirmation from the user before proceeding or terminate the connection with a bad certificate error.",
  )
  .appliesTo('user-agent')
  .done();
