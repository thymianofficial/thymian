import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-may-omit-header-fields-for-head-response',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A purely permissive MAY — a server is allowed to omit header fields whose values are only computable while generating content, so there is no non-conformant condition to detect.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'A server MAY omit header fields for which a value is determined only while generating the content.',
  )
  .appliesTo('server')
  .done();
