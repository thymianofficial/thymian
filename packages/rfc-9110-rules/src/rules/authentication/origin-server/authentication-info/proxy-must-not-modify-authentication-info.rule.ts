import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-not-modify-authentication-info')
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A proxy forwarding a response is not allowed to modify the Authentication-Info field value in any way.',
  )
  .appliesTo('proxy')
  .done();
