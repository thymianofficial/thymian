import { hasResponseBody, not, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-generate-content-for-409-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-409-conflict')
  .description(
    'The server SHOULD generate content that includes enough information for a user to recognize the source of the conflict.',
  )
  .explanation(
    'When a request fails with 409 because it clashes with the current state of the resource, the response body should explain what actually conflicts, not just report failure. This matters because a 409 is usually something the user can fix and resubmit; a body that spells out the source of the conflict lets them understand what went wrong and resolve it, whereas an empty response leaves them guessing why the request was rejected.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(statusCode(409), not(hasResponseBody())),
  )
  .done();
