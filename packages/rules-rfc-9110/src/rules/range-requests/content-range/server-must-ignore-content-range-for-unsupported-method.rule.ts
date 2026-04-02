import { and, method, or, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-ignore-content-range-for-unsupported-method',
)
  .severity('error')
  .type('analytics', 'static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'A server MUST ignore a Content-Range header field received in a request with a method for which Content-Range support is not defined.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        responseHeader('Content-Range'),
        or(method('POST'), method('DELETE'), method('OPTIONS'), method('GET')),
      ),
    ),
  )
  .done();
