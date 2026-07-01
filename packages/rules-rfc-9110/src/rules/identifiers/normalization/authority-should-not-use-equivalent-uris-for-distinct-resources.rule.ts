import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/authority-should-not-use-equivalent-uris-for-distinct-resources',
)
  .severity('warn')
  // Informational (#327): unobservable. Deciding that two normalization-
  // equivalent URIs identify DISTINCT resources requires resource-semantic
  // knowledge the authority holds; it cannot be inferred from recorded HTTP
  // messages alone.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-normalization-and-comparison',
  )
  .description(
    `Distinct resources SHOULD NOT be identified by HTTP URIs that are equivalent after normalization.`,
  )
  .done();
