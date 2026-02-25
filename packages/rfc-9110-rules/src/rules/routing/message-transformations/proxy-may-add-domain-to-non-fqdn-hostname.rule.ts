import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-may-add-domain-to-non-fqdn-hostname')
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'If a proxy receives a target URI with a host name that is not a fully qualified domain name, it MAY add its own domain to the host name it received when forwarding the request. This can help resolve ambiguous host names.',
  )
  .summary('Proxy MAY add domain to non-FQDN host name.')
  .appliesTo('proxy')
  .done();
