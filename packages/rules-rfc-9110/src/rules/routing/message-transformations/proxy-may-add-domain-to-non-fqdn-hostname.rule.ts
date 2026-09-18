import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- permissive MAY, host-resolution convenience — no hazard in the permission
export default httpRule('rfc9110/proxy-may-add-domain-to-non-fqdn-hostname')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A proxy that takes this up forwards a target URI whose host name has gained its own domain, where the request it received carried a bare, not fully qualified name; a multi-hop trace holds both messages with a role each. That comparison is not written yet.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'If a proxy receives a target URI with a host name that is not a fully qualified domain name, it MAY add its own domain to the host name it received when forwarding the request. This can help resolve ambiguous host names.',
  )
  .summary('Proxy MAY add domain to non-FQDN host name.')
  .appliesTo('proxy')
  .done();
