import { and, method, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-not-send-content-length-for-2xx-connect-response',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A server MUST NOT send a Content-Length header field in any 2xx (Successful) response to a CONNECT request.`,
  )
  .summary(
    'Servers MUST NOT send Content-Length header in 2xx responses to CONNECT requests.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('connect'), statusCodeRange(200, 299)),
      responseHeader('content-length'),
    ),
  )
  .done();
