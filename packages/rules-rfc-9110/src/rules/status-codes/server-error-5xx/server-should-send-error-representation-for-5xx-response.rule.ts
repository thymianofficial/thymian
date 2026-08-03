import {
  and,
  hasResponseBody,
  method,
  not,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-send-error-representation-for-5xx-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server-error-5xx')
  .description(
    'Except when responding to a HEAD request, the server SHOULD send a representation containing an explanation of the error situation, and whether it is a temporary or permanent condition.',
  )
  .explanation(
    'When you return any 5xx (Server Error) status, include a response body that explains what went wrong and whether the problem is temporary or permanent, unless the request was a HEAD (which by definition carries no body). This matters because a bare status code tells the client only that the server failed, not whether retrying is worthwhile or how to proceed; an explanatory representation lets user agents show something useful and helps developers diagnose the failure instead of guessing.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCodeRange(500, 599), not(method('HEAD'))),
      not(hasResponseBody()),
    ),
  )
  .done();
