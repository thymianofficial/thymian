import { and, method, not, or, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-send-content-length-for-request-with-defined-content',
)
  .severity('warn')
  // Request-side rule (outcome 4 → analyze-only): it constrains what the USER
  // AGENT sends. Thymian controls the request during `test` and there is no
  // live sender at `lint` time, so the SHOULD is only meaningful against
  // recorded traffic from a real client. `appliesTo('user-agent','client')`
  // matches the default HAR request role so the rule fires on HAR requests.
  .type('analytics')
  .appliesTo('user-agent', 'client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A user agent SHOULD send Content-Length in a request when the method defines a meaning for enclosed content and it is not sending Transfer-Encoding.`,
  )
  .summary('User agents SHOULD send Content-Length in requests with content.')
  .overrideAnalyticsRule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(method('post'), method('put'), method('patch')),
        not(requestHeader('transfer-encoding')),
        not(requestHeader('content-length')),
      ),
      (req, _res, location) => [
        {
          location,
          violation: {
            message: `A ${req.method} request sends neither Transfer-Encoding nor Content-Length. A user agent SHOULD send Content-Length when the method defines a meaning for enclosed content and Transfer-Encoding is not used.`,
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
