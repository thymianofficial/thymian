import { and, method, not, or, requestHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-ignore-if-modified-since-for-non-get-head',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'A recipient MUST ignore the If-Modified-Since header field if the request method is neither GET nor HEAD.',
  )
  .summary(
    'Recipient MUST ignore If-Modified-Since for methods other than GET or HEAD.',
  )
  .appliesTo('server', 'cache')
  .tags('conditional-requests', 'if-modified-since', 'methods')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-modified-since'),
        not(or(method('GET'), method('HEAD'))),
        // If server honored If-Modified-Since for non-GET/HEAD, it would return 304
        statusCode(304),
      ),
    ),
  )
  .done();
