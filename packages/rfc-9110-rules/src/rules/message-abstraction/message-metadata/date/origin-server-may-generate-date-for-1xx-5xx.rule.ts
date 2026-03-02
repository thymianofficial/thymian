import { and, not, or, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/origin-server-may-generate-date-for-1xx-5xx')
  .severity('hint')
  .type('analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'An origin server with a clock (as defined in Section 5.6.7) MAY generate a Date header field in 1xx (Informational) and 5xx (Server Error) responses.',
  )
  .summary('Origin servers MAY generate Date header in 1xx and 5xx responses.')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(statusCodeRange(100, 199), statusCodeRange(500, 599)),
        not(responseHeader('Date')),
      ),
    ),
  )
  .done();
