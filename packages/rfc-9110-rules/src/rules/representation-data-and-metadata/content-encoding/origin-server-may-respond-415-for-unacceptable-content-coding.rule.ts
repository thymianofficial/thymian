import {
  and,
  not,
  origin,
  path,
  requestHeader,
  responseWith,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-respond-415-for-unacceptable-content-coding',
)
  .severity('hint')
  .type('analytics', 'static')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `An origin server MAY respond with a status code of 415 (Unsupported Media Type) if a representation in the request message has a content coding that is not acceptable.`,
  )
  .summary(
    'Origin servers MAY respond with 415 for unacceptable content-coding in requests.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        requestHeader('content-encoding'),
        not(responseWith(statusCode(415))),
      ),
    ),
  )
  .overrideAnalyticsRule((ctx) =>
    // responseWith() cannot be compiled to SQL, so for analytics mode
    // we group by endpoint and check within each group whether any
    // transaction with Content-Encoding received a 415 response.
    ctx.validateGroupedCommonHttpTransactions(
      requestHeader('content-encoding'),
      and(origin(), path()),
      (_, transactions) => {
        const has415 = transactions.some(([, res]) => res.statusCode === 415);
        if (has415) {
          return undefined;
        }
        // No 415 response for this endpoint — report the first transaction
        const [, , location] = transactions[0] ?? [];
        return location ? { location } : undefined;
      },
    ),
  )
  .done();
