import {
  and,
  not,
  requestHeader,
  responseHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-send-content-range-in-416-response',
)
  .severity('warn')
  .type('analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'A server generating a 416 (Range Not Satisfiable) response to a byte-range request SHOULD send a Content-Range header field with an unsatisfied-range value. The complete-length in a 416 response indicates the current length of the selected representation.',
  )
  .summary(
    'Server should send Content-Range with unsatisfied-range in 416 responses.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCode(416), requestHeader('range')),
      not(responseHeader('content-range')),
    ),
  )
  .done();
