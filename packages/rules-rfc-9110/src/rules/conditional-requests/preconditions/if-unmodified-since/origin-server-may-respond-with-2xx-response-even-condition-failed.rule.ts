import { and, method, or, requestHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-respond-with-2xx-response-even-condition-failed-for-unmodified-since',
)
  .severity('hint')
  .type('test', 'static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An origin server that evaluates an If-Unmodified-Since condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code. Alternatively, if the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code (i.e., the change requested by the user agent has already succeeded, but the user agent might not be aware of it, perhaps because the prior response was lost or an equivalent change was made by some other user agent).',
  )
  .summary(
    'If the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code.',
  )
  .appliesTo('origin server')
  .tags(
    'conditional-requests',
    'if-unmodified-since',
    '412',
    'precondition-failed',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('if-unmodified-since'),
        statusCodeRange(400, 499),
        or(method('DELETE'), method('POST'), method('PATCH'), method('PUT')),
      ),
    ),
  )
  .done();
