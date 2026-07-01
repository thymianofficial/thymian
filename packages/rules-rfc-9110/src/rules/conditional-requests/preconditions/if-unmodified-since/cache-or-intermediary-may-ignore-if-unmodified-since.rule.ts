import { httpRule } from '@thymian/core';

/**
 * Informational (outcome 2). Permissive MAY: a cache or intermediary is allowed
 * to ignore If-Unmodified-Since. Both honoring and ignoring it are conformant,
 * so there is no non-conformant outcome to detect. The previous implementation
 * called `validateHttpTransactions(requestHeader('if-unmodified-since'))` with
 * no validation function, which flags *every* request carrying the header as a
 * violation — incorrect for a MAY. Reclassified to informational.
 */
export default httpRule(
  'rfc9110/cache-or-intermediary-may-ignore-if-unmodified-since',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A cache or intermediary MAY ignore If-Unmodified-Since because its interoperability features are only necessary for an origin server.',
  )
  .summary('Cache or intermediary MAY ignore If-Unmodified-since header field.')
  .appliesTo('cache', 'intermediary')
  .tags('conditional-requests', 'if-unmodified-since', 'cache')
  .done();
