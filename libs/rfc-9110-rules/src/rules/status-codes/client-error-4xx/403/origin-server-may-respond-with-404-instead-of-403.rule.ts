import { statusCode } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-may-respond-with-404-instead-of-403',
)
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden')
  .description(
    'An origin server that wishes to "hide" the current existence of a forbidden target resource MAY instead respond with a status code of 404 (Not Found).',
  )
  .appliesTo('origin server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(403)))
  .done();
