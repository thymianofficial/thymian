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
  .explanation(
    'A 421 (Misdirected Request) means a request reached a server that cannot produce an authoritative answer for that target URI, which is a judgement only the origin server (or a gateway acting for it) can make. A proxy just relays requests toward the origin and has no authority over which origin owns a URI, so it must never invent a 421 of its own. If a proxy did, it would wrongly tell clients the request was misdirected and could send them retrying elsewhere for no reason.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTransactions(
      statusCode(421),
      (transaction, location) =>
        transaction.response.meta.role === 'proxy'
          ? [
              {
                location,
                violation: {},
                findings: [],
              },
            ]
          : [],
    ),
  )
  .done();
