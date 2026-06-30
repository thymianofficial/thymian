import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-may-relay-credentials')
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p',
  )
  .description(
    'A proxy MAY relay the credentials from the client request to the next proxy if that is the mechanism by which the proxies cooperatively authenticate a given request.',
  )
  .appliesTo('proxy')
  .done();
