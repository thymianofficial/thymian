import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-should-not-modify-endpoint-and-representation-headers',
)
  .severity('warn')
  // Detecting a proxy that altered endpoint/representation headers
  // requires comparing the header values the proxy RECEIVED against those it FORWARDED.
  // That inbound-vs-forwarded correlation is only recoverable from captured multi-hop
  // traces at a deployment where the proxy role is recorded.
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    "A proxy SHOULD NOT modify header fields that provide information about the endpoints of the communication chain, the resource state, or the selected representation (other than the content) unless the field's definition specifically allows such modification or the modification is deemed necessary for privacy or security.",
  )
  .summary('Proxy SHOULD NOT modify endpoint and representation headers.')
  .appliesTo('proxy')
  .done();
