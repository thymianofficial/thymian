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
  .explanation(
    'When your 206 (Partial Content) response carries multiple ranges as multipart/byteranges content, you must not put a Content-Range header field in the main response header section; instead, each individual body part carries its own Content-Range describing the range it holds. This matters because a top-level Content-Range is how a single-part 206 signals its one range, so including it on a multipart response makes the message ambiguous and can lead clients to misinterpret which bytes they received.',
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
