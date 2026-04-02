import {
  and,
  method,
  not,
  requestHeader,
  responseWith,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-400-for-unsupported-partial-put',
)
  .severity('warn')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-partial-put')
  .description(
    'An origin server SHOULD respond with a 400 (Bad Request) status code if it receives Content-Range on a PUT for a target resource that does not support partial PUT requests.',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        method('PUT'),
        not(requestHeader('content-range')),
        not(responseWith(statusCode(400))),
      ),
    ),
  )
  .done();
