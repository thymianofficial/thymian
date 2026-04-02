import { and, method, or, requestHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-ignore-conditionals-for-connect-options-trace',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1')
  .description(
    'A server MUST ignore the conditional request header fields defined by this specification when received with a request method that does not involve the selection or modification of a selected representation, such as CONNECT, OPTIONS, or TRACE.',
  )
  .summary(
    'Server MUST ignore conditional headers for CONNECT, OPTIONS, or TRACE methods.',
  )
  .appliesTo('server')
  .tags('conditional-requests', 'evaluation', 'methods')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        or(method('CONNECT'), method('OPTIONS'), method('TRACE')),
        or(
          requestHeader('if-match'),
          requestHeader('if-none-match'),
          requestHeader('if-modified-since'),
          requestHeader('if-unmodified-since'),
        ),
        // If server evaluated conditionals, it would return 304 or 412
        or(statusCode(304), statusCode(412)),
      ),
    ),
  )
  .done();
