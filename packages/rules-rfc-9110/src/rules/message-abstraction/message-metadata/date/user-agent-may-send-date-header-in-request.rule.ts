import { not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/user-agent-may-send-date-header-in-request')
  .severity('hint')
  .type('analytics')
  .appliesTo('user-agent')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'A user agent MAY send a Date header field in a request, though generally will not do so unless it is believed to convey useful information to the server.',
  )
  .summary('A user agent MAY send a Date header field in a request.')
  .explanation(
    "A user agent is allowed, but not expected, to include a Date header in its requests indicating when the request was created. Most clients omit it because servers rarely need it, but a request Date can be useful for custom applications where the server adjusts its handling based on the difference between the client's clock and its own. Since this is entirely optional, a missing request Date is never a problem; the rule only surfaces it as an informational hint.",
  )
  .rule((ctx) => ctx.validateHttpTransactions(not(requestHeader('date'))))
  .done();
