import { and, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-send-te-connection-option-with-te-header',
)
  .severity('error')
  // Request-side rule (#327). `test` dropped: Thymian generates the request, so
  // it cannot exercise a sender that omits the Connection option. Validated
  // identically across `static` (described request) and `analytics` (recorded
  // request) using header-name presence only (the common projection). NOTE: the
  // common projection exposes only header *names*, so this catches a missing
  // Connection header entirely; it cannot verify a present Connection actually
  // lists the "TE" option (that needs the value), which is an accepted
  // under-approximation of the MUST.
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-te')
  .description(
    'A sender of TE MUST also send a "TE" connection option within the Connection header field to inform intermediaries not to forward this field.',
  )
  // Request-side: HAR requests default to the `user-agent` role.
  .appliesTo('client', 'user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('te'), not(requestHeader('connection'))),
    ),
  )
  .done();
