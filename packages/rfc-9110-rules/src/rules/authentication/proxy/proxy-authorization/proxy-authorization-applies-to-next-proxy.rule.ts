import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-authorization-applies-to-next-proxy')
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p',
  )
  .description(
    'Unlike Authorization, the Proxy-Authorization header field applies only to the next inbound proxy that demanded authentication using the Proxy-Authenticate header field.',
  )
  .appliesTo('client')
  .done();
