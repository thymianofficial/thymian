import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-may-send-retry-after-header-for-503-response',
)
  .severity('hint')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server-error-5xx')
  .description(
    'The server MAY send a Retry-After header field to suggest an appropriate amount of time for the client to wait before retrying the request.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(503),
      not(responseHeader('retry-after')),
    ),
  )
  .done();
