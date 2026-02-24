import { and, hasResponseBody, method, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/connect-2xx-response-must-not-include-content')
  .severity('error')
  .type('static', 'analytics', 'test')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.1')
  .description(
    '2xx (Successful) responses to a CONNECT request method switch the connection to tunnel mode instead of having content.',
  )
  .summary('2xx responses to CONNECT requests MUST NOT include content.')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('CONNECT'), statusCodeRange(200, 299), hasResponseBody()),
    ),
  )
  .done();
