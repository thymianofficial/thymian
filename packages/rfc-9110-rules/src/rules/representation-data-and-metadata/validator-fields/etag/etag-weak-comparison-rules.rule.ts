import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/etag-weak-comparison-rules')
  .severity('off')
  .type('informational')
  .appliesTo('server', 'client', 'intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2')
  .description(
    `Weak comparison: Two entity tags are equivalent if their opaque-tags match character-by-character,
    regardless of either or both being tagged as "weak". Weak comparison is used for:
    - Cache validation when semantic equivalence is sufficient (If-None-Match)
    - When the client doesn't require exact equality with previously obtained data

    Comparison examples:
    - W/"1" vs W/"1": match (opaque-tags match)
    - W/"1" vs "1": match (opaque-tags match, ignore weak prefix)
    - "1" vs "1": match (opaque-tags match)
    - W/"1" vs W/"2": no match (opaque-tags differ)`,
  )
  .summary(
    'Weak ETag comparison matches if opaque-tags match, ignoring weak prefix.',
  )
  .done();
