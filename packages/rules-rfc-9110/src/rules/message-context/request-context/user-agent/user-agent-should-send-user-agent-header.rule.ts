import { not, requestHeader, type RuleViolationLocation } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/user-agent-should-send-user-agent-header')
  .severity('warn')
  // Request-side, analytics-only (#327): a User-Agent header *presence* check on
  // real recorded requests. Header presence is enough, so the common projection
  // (header names) suffices. Not `test` (Thymian generates the request and
  // controls the User-Agent it sends) nor `static` (the spec does not assert a
  // client always populates User-Agent).
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A user agent SHOULD send a User-Agent header field in each request unless specifically configured not to do so.',
  )
  // Request-side: HAR requests default to the `user-agent` role.
  .appliesTo('user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      not(requestHeader('user-agent')),
      (_req, _res, location: RuleViolationLocation) => [
        {
          location,
          violation: {
            message:
              'The request does not carry a User-Agent header field. A user agent SHOULD send a User-Agent header in each request unless specifically configured not to.',
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
