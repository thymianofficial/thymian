import { and, not, or, responseHeader, statusCodeRange } from '@thymian/core';
import { httpRule } from '@thymian/core';

// A response-side server-behavior MUST that needs only the *presence* of the
// Date header on 2xx/3xx/4xx responses. Header-name presence is available in
// every context via the common projection, so a single shared `.rule()` runs
// identically at lint (described responses), test (live responses Thymian
// elicits), and analyze (recorded responses). The "with a clock" qualifier is
// not observable, but a missing Date on these status classes is the dominant,
// honest non-conformance signal. `appliesTo('origin server')` keeps it scoped
// to the responding origin and lets it fire on HAR (whose responses default to
// the `origin server` role).
export default httpRule(
  'rfc9110/origin-server-with-clock-must-generate-date-for-2xx-3xx-4xx',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'An origin server with a clock (as defined in Section 5.6.7) MUST generate a Date header field in all 2xx (Successful), 3xx (Redirection), and 4xx (Client Error) responses.',
  )
  .summary(
    'Origin servers with a clock MUST generate Date header in 2xx, 3xx, and 4xx responses.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        or(
          statusCodeRange(200, 299),
          statusCodeRange(300, 399),
          statusCodeRange(400, 499),
        ),
        not(responseHeader('date')),
      ),
    ),
  )
  .done();
