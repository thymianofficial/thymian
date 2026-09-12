import { httpRule } from '@thymian/core';

// A purely permissive MAY — a server is allowed to omit header fields whose
// values are computable only while generating content. There is no
// non-conformant condition to detect (omitting such a header is explicitly
// permitted).
// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-may-omit-header-fields-for-head-response',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'A server MAY omit header fields for which a value is determined only while generating the content.',
  )
  .appliesTo('server')
  .done();
