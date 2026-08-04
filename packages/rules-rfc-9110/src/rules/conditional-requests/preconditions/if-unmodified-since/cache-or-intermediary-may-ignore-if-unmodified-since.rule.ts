import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/cache-or-intermediary-may-ignore-if-unmodified-since',
)
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A cache or intermediary MAY ignore If-Unmodified-Since because its interoperability features are only necessary for an origin server.',
  )
  .summary('Cache or intermediary MAY ignore If-Unmodified-Since header field.')
  .explanation(
    "A cache or intermediary is allowed, but not required, to skip evaluating If-Unmodified-Since. This precondition is meant to protect the resource's state from unsafe concurrent changes, which is a concern that ultimately belongs to the origin server that owns the representation. An in-between cache typically can't authoritatively judge whether the resource was modified, so leaving the header to be enforced at the origin keeps the responsibility where the correct answer lives and avoids intermediaries making unsound decisions.",
  )
  .appliesTo('cache', 'intermediary')
  .rule((ctx) =>
    ctx.validateHttpTransactions(requestHeader('if-unmodified-since')),
  )
  .done();
