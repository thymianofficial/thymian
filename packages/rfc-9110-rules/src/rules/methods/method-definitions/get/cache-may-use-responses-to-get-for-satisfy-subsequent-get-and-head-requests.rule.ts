import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/cache-may-use-responses-to-get-for-satisfy-subsequent-get-and-head-requests',
)
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-get')
  .description(
    'a cache MAY use it to satisfy subsequent GET and HEAD requests unless otherwise indicated by the Cache-Control header field.',
  )
  .appliesTo('cache')
  .done();
