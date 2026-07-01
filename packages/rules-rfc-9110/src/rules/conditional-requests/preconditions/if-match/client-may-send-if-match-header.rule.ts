import { httpRule } from '@thymian/core';

/**
 * Informational (outcome 2). This is a permissive client-side MAY: a client is
 * allowed to send If-Match on a GET. Neither sending nor omitting the header is
 * non-conformant, so there is nothing to flag. The previous implementation
 * flagged every GET that did *not* carry If-Match, which is plainly wrong (the
 * vast majority of conformant GETs omit it). The rule is request-side, so even
 * a meaningful check would never belong in `test` (Thymian generates the
 * request); reclassified to informational with `appliesTo` scoped to the client
 * roles for documentation accuracy.
 */
export default httpRule('rfc9110/client-may-send-if-match-header')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A client MAY send an If-Match header field in a GET request to indicate that it would prefer a 412 (Precondition Failed) response if the selected representation does not match.',
  )
  .summary('A client MAY send an If-Match header field in a GET request.')
  .appliesTo('client', 'user-agent')
  .tags('conditional-requests', 'if-match', 'cache')
  .done();
