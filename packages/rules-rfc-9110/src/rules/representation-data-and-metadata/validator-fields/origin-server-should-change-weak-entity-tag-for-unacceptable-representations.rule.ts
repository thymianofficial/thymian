import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- cache-invalidation correctness, not a concern this vocabulary covers
export default httpRule(
  'rfc9110/origin-server-should-change-weak-entity-tag-for-unacceptable-representations',
)
  .severity('off')
  .type(
    'informational',
    'only-origin-knows',
    'Whether a prior representation is "unacceptable as a substitute" is a judgment only the origin server can make about its own data. No context can tell a correctly-unchanged weak tag from one that should have changed.',
  )
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1')
  .description(
    `An origin server SHOULD change a weak entity tag whenever it considers prior representations to be unacceptable
    as a substitute for the current representation. In other words, a weak entity tag ought to change whenever the
    origin server wants caches to invalidate old responses.`,
  )
  .summary(
    'Origin servers SHOULD change weak entity tags when prior representations are unacceptable.',
  )
  .done();
