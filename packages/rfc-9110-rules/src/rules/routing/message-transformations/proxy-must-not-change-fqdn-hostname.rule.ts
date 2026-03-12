import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-not-change-fqdn-hostname')
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MUST NOT change the host name if the target URI contains a fully qualified domain name. This prevents incorrect routing and ensures the request reaches the intended destination.',
  )
  .summary(
    'Proxy MUST NOT change host name when it is a fully qualified domain name.',
  )
  .appliesTo('proxy')
  .done();
