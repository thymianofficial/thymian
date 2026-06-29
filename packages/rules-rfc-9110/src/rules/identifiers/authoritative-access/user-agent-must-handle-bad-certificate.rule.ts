import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/user-agent-must-handle-bad-certificate')
  .severity('error')
  // Informational (outcome 2): this MUST governs the user agent's interactive
  // handling of an invalid certificate (prompt the user, or terminate with a bad
  // certificate error). It is user-agent-internal UX/transport behavior; neither
  // the user prompt nor the connection termination is visible in HTTP messages
  // or recorded traffic. No lint/test/analyze function can observe it. Kept as
  // documentation; security-relevant (see PR security section).
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verification',
  )
  .description(
    "If a certificate is not valid for the target URI's origin, a user agent MUST either obtain confirmation from the user before proceeding or terminate the connection with a bad certificate error.",
  )
  .appliesTo('user-agent')
  .done();
