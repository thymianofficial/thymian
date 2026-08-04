import { and, not, or, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-server-may-generate-date-for-1xx-5xx')
  .severity('hint')
  .type('analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'An origin server with a clock (as defined in Section 5.6.7) MAY generate a Date header field in 1xx (Informational) and 5xx (Server Error) responses.',
  )
  .summary('Origin servers MAY generate Date header in 1xx and 5xx responses.')
  .explanation(
    'An origin server that knows the current time is permitted, but not required, to include a Date header stating when it produced a 1xx (Informational) or 5xx (Server Error) response. This is optional because these response classes are less useful for caching than 2xx/3xx/4xx, where Date is mandatory. Supplying it anyway gives recipients a timestamp for age and clock-skew calculations, so this rule only hints that the header is absent rather than flagging an error.',
  )
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(statusCodeRange(100, 199), statusCodeRange(500, 599)),
        not(responseHeader('Date')),
      ),
    ),
  )
  .done();
