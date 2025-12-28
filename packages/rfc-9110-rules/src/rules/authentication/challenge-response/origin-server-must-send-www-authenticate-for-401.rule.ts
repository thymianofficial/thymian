import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-must-send-www-authenticate-for-401',
)
  .severity('error')
  .type('static', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-challenge-and-response',
  )
  .description(
    'A server generating a 401 (Unauthorized) response MUST send a WWW-Authenticate header field containing at least one challenge.',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(401),
      not(responseHeader('www-authenticate')),
    ),
  )
  .done();
