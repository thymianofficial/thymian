import { and, hasResponseBody, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

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
  .explanation(
    'When you return a 205 (Reset Content), you must not include any response body. A 205 tells the user agent to clear the form or input view that triggered the request so the user can start fresh, and by definition it promises no additional content will follow. This matters because a client expecting an empty 205 may not read a body, so sending one risks it being ignored or misframed on the connection, breaking the request that follows. Keep the response header-only.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(and(statusCode(205), hasResponseBody())),
  )
  .done();
