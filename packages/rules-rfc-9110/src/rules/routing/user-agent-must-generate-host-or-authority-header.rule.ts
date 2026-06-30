import { and, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-generate-host-or-authority-header',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-host-and-authority')
  .description(
    'A user agent MUST generate a Host header field in a request unless it sends that information as an ":authority" pseudo-header field. The target URI\'s authority information is critical for handling a request.',
  )
  .summary('User agent MUST generate a Host or :authority header in a request.')
  .appliesTo('user-agent')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(not(requestHeader('host')), not(requestHeader(':authority'))),
      // The filter selects requests carrying neither Host nor :authority, so
      // every matched request is a violation.
      (_req, _res, location) => [
        {
          location,
          violation: {
            message:
              'The request carries neither a Host header field nor an ":authority" pseudo-header field. A user agent MUST supply the target URI authority via one of them.',
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
