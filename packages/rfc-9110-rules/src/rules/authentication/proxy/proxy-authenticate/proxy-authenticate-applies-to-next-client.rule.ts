import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-authenticate-applies-to-next-client')
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p',
  )
  .description(
    'Unlike WWW-Authenticate, the Proxy-Authenticate header field applies only to the next outbound client on the response chain.',
  )
  .appliesTo('proxy')
  .done();
