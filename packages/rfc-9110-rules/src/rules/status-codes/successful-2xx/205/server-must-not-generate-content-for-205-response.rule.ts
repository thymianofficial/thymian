import { and, hasResponseBody, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-not-generate-content-for-205-response',
)
  .severity('error')
  .type('test', 'static', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-205-reset-content')
  .description(
    `Since the 205 status code implies that no additional content will be provided, a server MUST NOT generate content in a 205 response.`,
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(and(statusCode(205), hasResponseBody())),
  )
  .done();
