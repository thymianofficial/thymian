import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-change-fqdn-hostname')
  .severity('error')
  // Detecting a changed FQDN host name requires comparing the target
  // URI authority the proxy RECEIVED against the one it FORWARDED to the next server.
  // That inbound-vs-forwarded correlation is only recoverable from captured multi-hop
  // traces at a deployment where the proxy role is recorded.
  .type('analytics')
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
