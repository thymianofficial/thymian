import { not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-send-www-authenticate-in-other-responses',
)
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A server MAY generate a WWW-Authenticate header field in other response messages to indicate that supplying credentials (or different credentials) might affect the response.',
  )
  .explanation(
    'A server is allowed to include a WWW-Authenticate header on responses other than a 401, as an optional hint that sending credentials, or different credentials, might change the outcome. It is not required to do so. This lets a server nudge a client toward authenticating even when it did not outright reject the request, which can help clients discover that a better-authorized response is available.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(not(responseHeader('www-authenticate'))),
  )
  .done();
