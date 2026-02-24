import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/user-agent-must-handle-bad-certificate')
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verification',
  )
  .description(
    "If a certificate is not valid for the target URI's origin, a user agent MUST either obtain confirmation from the user before proceeding or terminate the connection with a bad certificate error..",
  )
  .appliesTo('user-agent')
  .done();
