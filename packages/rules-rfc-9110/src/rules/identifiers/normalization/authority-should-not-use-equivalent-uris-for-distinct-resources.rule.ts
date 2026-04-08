import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/authority-should-not-use-equivalent-uris-for-distinct-resources',
)
  .severity('warn')
  .type('static')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-normalization-and-comparison',
  )
  .description(
    `Distinct resources SHOULD NOT be identified by HTTP URIs that are equivalent after normalization.`,
  )
  .done();
