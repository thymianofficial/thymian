import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/other-methods-than-get-and-head-are-optional')
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A purely permissive statement — every method other than GET and HEAD is OPTIONAL, so there is no non-conformant condition to detect; a server is free to implement, or reject with 501, any other method.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description('Other methods than GET and HEAD are OPTIONAL.')
  .appliesTo('server')
  .done();
