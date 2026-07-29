import { httpRule } from '@thymian/core';

// A cache MAY reuse a GET response for subsequent GET/HEAD requests — a purely
// permissive allowance with no non-conformant condition to detect. Observing
// that a cache *did* reuse a response would require cache-hit correlation
// across two requests, which is infrastructure-dependent; but since the
// statement is permissive (a MAY) there is nothing to flag even if that
// linkage were available.
export default httpRule(
  'rfc9110/cache-may-use-responses-to-get-for-satisfy-subsequent-get-and-head-requests',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-get')
  .description(
    'A cache MAY use it to satisfy subsequent GET and HEAD requests unless otherwise indicated by the Cache-Control header field.',
  )
  .appliesTo('cache')
  .done();
