import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-generate-retry-after-header-for-413-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-413-content-too-large')
  .description(
    'If the condition is temporary, the server SHOULD generate a Retry-After header field to indicate that it is temporary and after what time the client may try again.',
  )
  .explanation(
    'When a server rejects a request with 413 because the request body is too large, and that limit is only temporary, it should add a Retry-After header telling the client how long to wait before trying again. This matters because it distinguishes a passing overload from a permanent limit and gives the client a concrete time to retry, so it can back off politely instead of either giving up or hammering the server immediately.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(413),
      not(responseHeader('retry-after')),
    ),
  )
  .done();
