import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/other-methods-than-get-and-head-are-optional')
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    "Section 9.1 states the requirement level of the methods beyond GET and HEAD rather than placing an obligation on a sender or a recipient, so no HTTP message can conform to it or violate it. What is observable about a server's method support is carried by general-purpose-servers-must-support-get-and-head and by the 405 and 501 rules.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description('Other methods than GET and HEAD are OPTIONAL.')
  .appliesTo('server')
  .done();
