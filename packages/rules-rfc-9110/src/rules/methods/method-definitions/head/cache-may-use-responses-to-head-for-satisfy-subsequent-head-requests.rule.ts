import { httpRule } from '@thymian/core';

// A cache MAY reuse a HEAD response for subsequent HEAD requests — a purely
// permissive allowance with no non-conformant condition to detect. As with the
// GET counterpart, observing actual reuse would need cache-hit correlation,
// but since the statement is a MAY there is nothing to flag regardless.
export default httpRule(
  'rfc9110/cache-may-use-responses-to-head-for-satisfy-subsequent-head-requests',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-get')
  .description(
    'a cache MAY use it to satisfy subsequent GET and HEAD requests unless otherwise indicated by the Cache-Control header field.',
  )
  .appliesTo('cache')
  .done();
