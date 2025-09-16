import { and, method, statusCodeRange } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-make-own-decision-to-redirect-request-for-3xx-response-to-put-request'
)
  .severity('hint')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'The user agent MAY then make its own decision regarding whether or not to redirect the request.'
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('PUT'), statusCodeRange(300, 399))
    )
  )
  .done();
