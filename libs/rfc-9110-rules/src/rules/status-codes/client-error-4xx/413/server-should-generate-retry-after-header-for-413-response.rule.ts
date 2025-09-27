import { not, responseHeader, statusCode } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-generate-retry-after-header-for-413-response',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-413-content-too-large')
  .description(
    'If the condition is temporary, the server SHOULD generate a Retry-After header field to indicate that it is temporary and after what time the client may try again.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(413),
      not(responseHeader('retry-after')),
    ),
  )
  .done();
