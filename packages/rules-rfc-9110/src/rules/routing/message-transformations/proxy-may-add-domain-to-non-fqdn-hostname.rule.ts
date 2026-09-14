import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- permissive MAY, host-resolution convenience — no hazard in the permission
export default httpRule('rfc9110/proxy-may-add-domain-to-non-fqdn-hostname')
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A permission — completing a non-FQDN host with a local domain is an optional proxy behavior, so its presence is never a violation.',
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
