import { httpRule } from '@thymian/core';

/**
 * Informational (outcome 2). This is a permissive MAY: a cache or intermediary
 * is allowed to ignore If-Match. There is no non-conformant outcome to detect —
 * both honoring and ignoring the header are conformant. The previous
 * implementation called `validateHttpTransactions(requestHeader('if-match'))`
 * with no validation function, which flags *every* request carrying If-Match as
 * a violation; that is incorrect for a MAY. Reclassified to informational.
 */
export default httpRule('rfc9110/cache-or-intermediary-may-ignore-if-match')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A cache or intermediary MAY ignore If-Match because its interoperability features are only necessary for an origin server.',
  )
  .summary('Cache or intermediary MAY ignore If-Match header field.')
  .appliesTo('cache', 'intermediary')
  .tags('conditional-requests', 'if-match', 'cache')
  .done();
