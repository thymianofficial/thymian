import {
  and,
  hasRequestBody,
  hasResponseBody,
  not,
  or,
  requestHeader,
  responseHeader,
} from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/recipient-may-assume-media-type-or-determine-its-type',
)
  .severity('warn')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3')
  .description(
    `If a Content-Type header field is not present, the recipient MAY either assume a media type of "application/octet-stream" ([RFC2046], Section 4.5.1) or examine the data to determine its type.`,
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      or(hasRequestBody(), hasResponseBody()),
      or(
        and(hasRequestBody(), not(requestHeader('content-type'))),
        and(hasResponseBody(), not(responseHeader('content-type'))),
      ),
    ),
  )
  .done();
