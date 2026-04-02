import { and, getHeader, method, not, or, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-send-content-length-for-request-with-defined-content',
)
  .severity('warn')
  .type('analytics')
  .appliesTo('user-agent', 'client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A user agent SHOULD send Content-Length in a request when the method defines a meaning for enclosed content and it is not sending Transfer-Encoding.`,
  )
  .summary('User agents SHOULD send Content-Length in requests with content.')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(method('post'), method('put'), method('patch')),
        not(requestHeader('transfer-encoding')),
        not(requestHeader('content-length')),
      ),
    ),
  )
  .done();
