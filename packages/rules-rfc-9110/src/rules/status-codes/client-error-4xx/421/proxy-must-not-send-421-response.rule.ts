import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-send-421-response')
  .severity('error')
  // The prohibition applies only to *proxies*: an origin server MAY legitimately
  // generate a 421 (Misdirected Request). The rule therefore needs the sender's
  // role, which is only available on captured (recorded) transactions, so it is
  // analyze-only: it inspects the captured response role and flags only 421
  // responses emitted by a proxy.
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-421-misdirected-request',
  )
  .description('A proxy MUST NOT generate a 421 response.')
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTransactions(
      statusCode(421),
      (transaction, location) =>
        transaction.response.meta.role === 'proxy'
          ? [
              {
                location,
                violation: {
                  message:
                    'A proxy generated a 421 (Misdirected Request) response. A proxy MUST NOT generate a 421 response; this status is reserved for origin servers.',
                },
                findings: [],
              },
            ]
          : [],
    ),
  )
  .done();
