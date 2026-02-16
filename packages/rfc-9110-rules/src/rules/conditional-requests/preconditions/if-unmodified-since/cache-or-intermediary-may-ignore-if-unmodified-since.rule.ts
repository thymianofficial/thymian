import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/cache-or-intermediary-may-ignore-if-unmodified-since',
)
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A cache or intermediary MAY ignore If-Unmodified-Since because its interoperability features are only necessary for an origin server.',
  )
  .summary('Cache or intermediary MAY ignore If-Unmodified-since header field.')
  .appliesTo('cache', 'intermediary')
  .tags('conditional-requests', 'if-match', 'cache')
  .rule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('if-unmodified-since')),
  )
  .done();
