// origin-server-should-limit-addition-of-subproducts-by-third-parties
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-limit-addition-of-subproducts-by-third-parties',
)
  .severity('warn')
  // Informational: whether a subproduct was "added by a third party" is not
  // determinable from the wire value of a single Server field, and the limit is
  // a subjective judgment; surfaced as guidance only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin SHOULD limit the addition of subproducts by third parties.',
  )
  .appliesTo('origin server')
  .done();
