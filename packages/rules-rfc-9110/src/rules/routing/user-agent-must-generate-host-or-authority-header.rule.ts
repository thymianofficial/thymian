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
  .explanation(
    'Every request must carry the target host and port, supplied either in a Host header (HTTP/1.1) or in the ":authority" pseudo-header (HTTP/2 and HTTP/3); a user agent must always include one of them. This information is what lets a server that hosts many sites on one address know which one the request is for. Without it the server cannot reliably route the request to the right resource, so the request is malformed and may be rejected.',
  )
  .appliesTo('user-agent')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(not(requestHeader('host')), not(requestHeader(':authority'))),
    ),
  )
  .done();
