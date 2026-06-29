import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-must-send-proxy-authenticate-header-for-407-response',
)
  .severity('error')
  // Response-side server-behavior check, but specific to a *proxy* (a 407 is
  // emitted by a proxy, not an origin). It is therefore analyze-only and scoped
  // to the `proxy` role: in test, Thymian targets an origin (not a forwarding
  // proxy), so a 407 cannot be meaningfully provoked. The check itself only
  // needs header *presence* (Proxy-Authenticate), so the common projection
  // suffices. appliesTo('proxy') restricts evaluation to captured transactions
  // whose role is proxy.
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-407-proxy-authentication-re',
  )
  .description(
    'The proxy MUST send a Proxy-Authenticate header field containing a challenge applicable to that proxy for the request.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(407),
      not(responseHeader('proxy-authenticate')),
    ),
  )
  .done();
