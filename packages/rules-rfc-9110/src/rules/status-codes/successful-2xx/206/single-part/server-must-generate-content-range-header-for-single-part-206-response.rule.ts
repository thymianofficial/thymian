import {
  and,
  method,
  not,
  responseHeader,
  responseMediaType,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-generate-content-range-header-for-single-part-206-response',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-single-part')
  .description(
    'If a single part is being transferred, the server generating the 206 response MUST generate a Content-Range header field, describing what range of the selected representation is enclosed, and a content consisting of the range.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('GET'), statusCode(206)),
      and(
        not(responseHeader('content-range')),
        not(responseMediaType('multipart/byteranges')),
      ),
    ),
  )
  .done();
