import { and, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-must-not-generate-if-range-without-range',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A client MUST NOT generate an If-Range header field in a request that does not contain a Range header field.',
  )
  .summary('Client MUST NOT generate If-Range without Range header field.')
  .appliesTo('client')
  .tags('conditional-requests', 'if-range', 'range')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('if-range'), not(requestHeader('range'))),
    ),
  )
  .done();
