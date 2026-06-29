// user-agent-should-limit-addition-of-subproducts-by-third-parties

import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-limit-addition-of-subproducts-by-third-parties',
)
  .severity('hint')
  // Informational (#327): conformance turns on *who* added a subproduct (a
  // third party) and a subjective notion of "limit", neither of which is
  // observable from the User-Agent value alone. No reliable non-conformant
  // condition to detect. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A user agent SHOULD limit the addition of subproducts by third parties. Overly long and detailed User-Agent field values increase request latency and the risk of a user being identified against their wishes ("fingerprinting").',
  )
  .appliesTo('user-agent')
  .done();
