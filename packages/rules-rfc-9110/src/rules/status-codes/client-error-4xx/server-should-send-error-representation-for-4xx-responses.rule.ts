import {
  and,
  hasResponseBody,
  method,
  not,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-send-error-representation-for-4xx-responses',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-client-error-4xx')
  .summary(
    'The server SHOULD send a representation containing an explanation of the error situation, and whether it is a temporary or permanent condition.',
  )
  .description(
    'The 4xx (Client Error) class of status code indicates that the client seems to have erred. Except when responding to a HEAD request, the server SHOULD send a representation containing an explanation of the error situation, and whether it is a temporary or permanent condition.',
  )
  .explanation(
    'Whenever a server returns a 4xx status because the client got something wrong, it should include a response body that explains what the problem was and whether it is temporary or permanent (the one exception is HEAD requests, which by definition carry no body). This matters because the bare status code rarely says enough; an explanatory body lets a developer or user see what to fix and whether retrying could help, instead of being left with an opaque failure.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(not(method('HEAD')), statusCodeRange(400, 499)),
      not(hasResponseBody()),
    ),
  )
  .done();
