import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-modify-authorization')
  .severity('error')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A proxy forwarding a request MUST NOT modify any Authorization header fields in that request.',
  )
  .appliesTo('proxy')
  .done();
