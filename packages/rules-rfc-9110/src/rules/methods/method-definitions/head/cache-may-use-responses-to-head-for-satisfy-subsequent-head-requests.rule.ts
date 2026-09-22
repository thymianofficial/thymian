import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/cache-may-use-responses-to-head-for-satisfy-subsequent-head-requests',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A cache that takes this up answers a later HEAD from store: the captured trace holds the served response, carrying Age, with no upstream transaction behind it. The hint — a cacheable HEAD response the cache never reused — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'The response to a HEAD request is cacheable; a cache MAY use it to satisfy subsequent HEAD requests unless otherwise indicated by the Cache-Control header field.',
  )
  .appliesTo('cache')
  .done();
