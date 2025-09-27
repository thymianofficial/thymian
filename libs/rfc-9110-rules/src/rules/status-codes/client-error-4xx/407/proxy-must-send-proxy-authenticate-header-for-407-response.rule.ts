import { not, responseHeader, statusCode } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-must-send-proxy-authenticate-header-for-407-response',
)
  .severity('error')
  .type('static', 'analytics')
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
