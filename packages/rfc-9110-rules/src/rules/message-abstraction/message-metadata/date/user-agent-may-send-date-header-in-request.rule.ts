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
  .rule((ctx) => ctx.validateHttpTransactions(not(requestHeader('date'))))
  .done();
