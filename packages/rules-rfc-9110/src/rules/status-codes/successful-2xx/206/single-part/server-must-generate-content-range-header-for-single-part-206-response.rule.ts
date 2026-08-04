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
  .explanation(
    'When a 206 Partial Content response carries a single byte range (rather than a multipart/byteranges body), the server must include a Content-Range header that states which bytes of the full representation are enclosed and how long the whole thing is, for example bytes 21010-47021/47022. Without it, the client has no way to know where the received bytes belong in the complete resource, so it cannot correctly reassemble the file or request the remaining ranges.',
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
