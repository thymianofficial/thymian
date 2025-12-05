import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-must-send-proxy-authenticate-in-407-response',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.7.1')
  .description(
    'A proxy MUST send at least one Proxy-Authenticate header field in each 407 (Proxy Authentication Required) response that it generates.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(407),
      not(responseHeader('proxy-authenticate')),
    ),
  )
  .done();
