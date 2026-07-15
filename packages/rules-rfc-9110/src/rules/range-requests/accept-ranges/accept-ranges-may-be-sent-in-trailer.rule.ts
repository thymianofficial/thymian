import { httpRule, responseTrailer } from '@thymian/core';

export default httpRule('rfc9110/accept-ranges-may-be-sent-in-trailer')
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-ranges')
  .description(
    'The Accept-Ranges field MAY be sent in a trailer section, but is preferred to be sent as a header field because the information is particularly useful for restarting large information transfers that have failed in mid-content (before the trailer section is received).',
  )
  .summary(
    'Accept-Ranges may be sent in a trailer, but the header field is preferred for failed-transfer recovery.',
  )
  .appliesTo('server')
  // Sending Accept-Ranges in a trailer is a conformant MAY, so this surfaces (as
  // analytics) the allowed-but-non-preferred placement: a trailer arrives too
  // late to help a client restart a failed transfer, for which the header form
  // is preferred.
  .rule((ctx) => ctx.validateHttpTransactions(responseTrailer('accept-ranges')))
  .done();
