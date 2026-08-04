import { and, not, requestHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-respond-with-417-response-for-other-expect-than-100-continue',
)
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that receives an Expect field value containing a member other than 100-continue MAY respond with a 417 (Expectation Failed) status code to indicate that the unexpected expectation cannot be met.',
  )
  .explanation(
    "The only expectation this specification defines is 100-continue. If a request's Expect header asks for anything else, the server is allowed to reject it by replying 417 (Expectation Failed) rather than proceeding. Signaling that the requested expectation cannot be met, instead of silently ignoring it, lets the client learn its expectation was unsupported and adjust or retry without it, which keeps the exchange predictable.",
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        requestHeader('expect'),
        not(requestHeader('expect', '100-continue')),
        not(statusCode(417)),
      ),
    ),
  )
  .done();
