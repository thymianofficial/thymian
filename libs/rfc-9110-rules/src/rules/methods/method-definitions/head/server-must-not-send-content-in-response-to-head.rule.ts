import { and, hasRequestBody, method } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-not-send-content-in-response-to-head',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'The HEAD method is identical to GET except that the server MUST NOT send content in the response.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(and(method('HEAD'), hasRequestBody())),
  )
  .done();
