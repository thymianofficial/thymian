import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-authentication-info-applies-to-next-client',
)
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-clients-to-p',
  )
  .description(
    'The Proxy-Authentication-Info header field applies only to the next outbound client on the response chain.',
  )
  .appliesTo('proxy')
  .done();
