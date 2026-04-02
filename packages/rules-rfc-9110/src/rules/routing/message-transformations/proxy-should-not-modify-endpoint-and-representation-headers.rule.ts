import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-should-not-modify-endpoint-and-representation-headers',
)
  .severity('warn')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    "A proxy SHOULD NOT modify header fields that provide information about the endpoints of the communication chain, the resource state, or the selected representation (other than the content) unless the field's definition specifically allows such modification or the modification is deemed necessary for privacy or security.",
  )
  .summary('Proxy SHOULD NOT modify endpoint and representation headers.')
  .appliesTo('proxy')
  .done();
