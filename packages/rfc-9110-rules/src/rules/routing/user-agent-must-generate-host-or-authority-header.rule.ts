import { and, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-must-generate-host-or-authority-header',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-host-and-authority')
  .description(
    'A user agent MUST generate a Host header field in a request unless it sends that information as an ":authority" pseudo-header field. The target URI\'s authority information is critical for handling a request.',
  )
  .appliesTo('user-agent')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(not(requestHeader('host')), not(requestHeader(':authority'))),
    ),
  )
  .done();
