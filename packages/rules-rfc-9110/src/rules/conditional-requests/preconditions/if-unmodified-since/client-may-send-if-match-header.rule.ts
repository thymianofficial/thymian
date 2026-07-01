import { httpRule } from '@thymian/core';

/**
 * Informational (outcome 2). Permissive client-side MAY: a client is allowed to
 * send If-Unmodified-Since on a GET. Neither sending nor omitting the header is
 * non-conformant. The previous implementation flagged every GET that did not
 * carry an If-Match header (the wrong header, and an inverted condition for a
 * MAY) — mis-flagging virtually all conformant GETs. Being client-side, even a
 * meaningful check could never belong in `test`; reclassified to informational
 * with `appliesTo` scoped to the client roles.
 */
export default httpRule('rfc9110/client-may-send-if-unmodified-since-header')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A client MAY send an If-Unmodified-Since header field in a GET request to indicate that it would prefer a 412 (Precondition Failed) response if the selected representation has been modified. However, this is only useful in range requests (Section 14) for completing a previously received partial representation when there is no desire for a new representation. If-Range (Section 13.1.5) is better suited for range requests when the client prefers to receive a new representation.',
  )
  .summary(
    'A client MAY send an If-Unmodified-since header field in a GET request.',
  )
  .appliesTo('client', 'user-agent')
  .tags('conditional-requests', 'if-unmodified-since', 'cache')
  .done();
