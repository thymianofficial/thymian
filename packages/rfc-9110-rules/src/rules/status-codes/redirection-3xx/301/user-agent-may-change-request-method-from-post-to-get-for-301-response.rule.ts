import { and, method, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-change-request-method-from-post-to-get-for-301-response',
)
  .severity('hint')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-301-moved-permanently')
  .summary(
    'For historical reasons, a user agent MAY change the request method from POST to GET for the subsequent request.',
  )
  .description(
    'For historical reasons, a user agent MAY change the request method from POST to GET for the subsequent request. If this behavior is undesired, the 308 (Permanent Redirect) status code can be used instead.',
  )
  .appliesTo('user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(and(method('POST'), statusCode(301))),
  )
  .done();
