import { and, method, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-may-send-if-match-header')
  .severity('hint')
  .type('analytics', 'static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A client MAY send an If-Match header field in a GET request to indicate that it would prefer a 412 (Precondition Failed) response if the selected representation does not match.',
  )
  .summary('A client MAY send an If-Match header field in a GET request.')
  .appliesTo('client')
  .tags('conditional-requests', 'if-match', 'cache')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('GET'), not(requestHeader('if-match'))),
    ),
  )
  .done();
