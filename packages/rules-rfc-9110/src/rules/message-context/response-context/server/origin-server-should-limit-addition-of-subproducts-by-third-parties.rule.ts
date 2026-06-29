// origin-server-should-limit-addition-of-subproducts-by-third-parties
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-limit-addition-of-subproducts-by-third-parties',
)
  .severity('warn')
  // Informational (#327): conformance turns on *who* added a subproduct (a third
  // party) to the Server header and a subjective notion of "limit", neither of
  // which is observable from the Server value alone. No reliable non-conformant
  // condition to detect. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin SHOULD limit the addition of subproducts by third parties.',
  )
  .appliesTo('origin server')
  .done();
