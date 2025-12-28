import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-not-modify-www-authenticate')
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A proxy forwarding a response MUST NOT modify any WWW-Authenticate header fields in that response.',
  )
  .appliesTo('proxy')
  .done();
