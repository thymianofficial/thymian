import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-send-www-authenticate-in-401-response',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.6.1')
  .description(
    'A server generating a 401 (Unauthorized) response MUST send a WWW-Authenticate header field containing at least one challenge.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(401),
      not(responseHeader('www-authenticate')),
    ),
  )
  .done();
