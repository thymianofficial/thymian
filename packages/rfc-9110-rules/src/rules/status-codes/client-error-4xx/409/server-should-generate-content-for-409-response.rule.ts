import { hasResponseBody, not, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-generate-content-for-409-response',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-409-conflict')
  .description(
    'The server SHOULD generate content that includes enough information for a user to recognize the source of the conflict.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(statusCode(409), not(hasResponseBody())),
  )
  .done();
