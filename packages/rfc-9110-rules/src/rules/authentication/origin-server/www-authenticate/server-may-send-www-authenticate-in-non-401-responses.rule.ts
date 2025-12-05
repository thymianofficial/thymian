import { and, not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-may-send-www-authenticate-in-non-401-responses',
)
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.6.1')
  .description(
    'A server MAY generate a WWW-Authenticate header field in other response messages to indicate that supplying credentials (or different credentials) might affect the response.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      // Find responses with WWW-Authenticate that are NOT 401
      and(responseHeader('www-authenticate'), not(statusCode(401))),
      // This is informational - not a violation
      // Just tracking usage patterns
      () => false,
    ),
  )
  .done();
