import { and, method, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-may-send-if-match-header')
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'A client MAY send an If-Match header field in a GET request to indicate that it would prefer a 412 (Precondition Failed) response if the selected representation does not match.',
  )
  .summary('A client MAY send an If-Match header field in a GET request.')
  .explanation(
    'A client is allowed to attach an If-Match header to a GET, signaling that it would rather receive a 412 (Precondition Failed) than a fresh body if the selected representation no longer matches the given entity tag. It is optional. This is mainly useful for range requests completing a partial download, where the client only wants more of the same representation it already has and does not want a different, newer one silently substituted.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('GET'), not(requestHeader('if-match'))),
    ),
  )
  .done();
