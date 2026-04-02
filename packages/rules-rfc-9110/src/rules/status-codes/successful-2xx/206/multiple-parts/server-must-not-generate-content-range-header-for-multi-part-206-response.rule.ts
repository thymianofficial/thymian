import {
  and,
  method,
  responseHeader,
  responseMediaType,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-generate-content-range-header-for-multi-part-206-response',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'To avoid confusion with single-part responses, a server MUST NOT generate a Content-Range header field in the HTTP header section of a multiple part response (this field will be sent in each part instead).',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        method('GET'),
        statusCode(206),
        responseMediaType('multipart/byteranges'),
      ),
      responseHeader('content-range'),
    ),
  )
  .done();
