import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/authority-should-not-use-equivalent-uris-for-distinct-resources',
)
  .severity('warn')
  // Reclassified static -> informational (outcome 4 then outcome 2). Previously
  // declared `static` with no rule function. The requirement is that two URIs
  // that normalize to the same value should not denote *distinct* resources.
  // Deciding whether two resources are "distinct" requires semantic knowledge of
  // the application's resource model — it is not derivable from the OpenAPI
  // description (paths are templates, not concrete equivalent URIs to compare),
  // nor from observed/recorded traffic (two equivalent URIs returning different
  // representations could be correct content negotiation, redirects, or
  // time-varying data, not a violation). With no decidable non-conformant
  // condition available to lint/test/analyze, it is informational.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-normalization-and-comparison',
  )
  .description(
    `Distinct resources SHOULD NOT be identified by HTTP URIs that are equivalent after normalization.`,
  )
  .done();
