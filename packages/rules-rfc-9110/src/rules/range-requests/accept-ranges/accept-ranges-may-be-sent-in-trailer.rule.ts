import {
  and,
  httpRule,
  not,
  requestHeader,
  responseTrailer,
} from '@thymian/core';

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
  .explanation(
    'A server is permitted to place Accept-Ranges in the trailer section, but sending it as a normal header is preferred. This matters because Accept-Ranges tells a client whether it can resume a large transfer with a range request, and the trailer arrives only after the whole body has been sent, too late to help recover a transfer that failed mid-content. Putting it in the header lets the client know up front, so this surfaces as advice rather than a violation.',
  )
  .appliesTo('server')
  // Sending Accept-Ranges in a trailer is a conformant MAY, but the header form
  // is preferred (a trailer arrives too late to help a client restart a failed
  // transfer). Surfaced as analytics rather than a violation.
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        requestHeader('accept-ranges'),
        not(responseTrailer('accept-ranges')),
      ),
    ),
  )
  .done();
