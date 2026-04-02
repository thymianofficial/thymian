import {
  and,
  or,
  responseHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-send-content-length-for-1xx-or-204',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A server MUST NOT send a Content-Length header field in any response with a status code of 1xx (Informational) or 204 (No Content).`,
  )
  .summary(
    'Servers MUST NOT send Content-Length header in 1xx or 204 responses.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(or(statusCodeRange(100, 199), statusCode(204))),
      responseHeader('content-length'),
    ),
  )
  .done();
