import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/etag-strong-comparison-rules')
  .severity('off')
  // Informational (outcome 2): this defines the strong entity-tag COMPARISON
  // ALGORITHM that a recipient applies internally when evaluating conditional
  // requests (If-Match, If-Range). It prescribes no field a sender must emit
  // and is purely the recipient's internal matching logic, which is not
  // observable from the transaction. Reference material, kept informational.
  .type('informational')
  .appliesTo('server', 'client', 'intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2')
  .description(
    `Strong comparison: Two entity tags are equivalent if and only if both are not weak AND their opaque-tags
    match character-by-character. Strong comparison is used for:
    - Cache validation when exact match is required
    - Range requests (If-Range with ETag)
    - Preventing lost updates (If-Match)

    Comparison examples:
    - W/"1" vs W/"1": no match (both weak)
    - W/"1" vs "1": no match (one weak)
    - "1" vs "1": match (both strong, opaque-tags match)
    - "1" vs "2": no match (opaque-tags differ)`,
  )
  .summary(
    'Strong ETag comparison requires both tags to be strong with matching opaque-tags.',
  )
  .done();
