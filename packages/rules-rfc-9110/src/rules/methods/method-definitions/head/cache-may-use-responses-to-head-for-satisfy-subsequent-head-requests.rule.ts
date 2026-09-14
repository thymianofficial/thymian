import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/cache-may-use-responses-to-head-for-satisfy-subsequent-head-requests',
)
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A cache MAY reuse a HEAD response for subsequent HEAD requests — a purely permissive allowance with nothing non-conformant to detect either way.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-get')
  .description(
    'a cache MAY use it to satisfy subsequent GET and HEAD requests unless otherwise indicated by the Cache-Control header field.',
  )
  .appliesTo('cache')
  .done();
