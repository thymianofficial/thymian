import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-shoud-resend-original-request-with-modifications-for-redirected-requests',
)
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    "Constrains how a user agent rebuilds a follow-up request after a redirect. Attributing a request to a prior redirect, and knowing the 'original' request it derives from, is internal to the user agent and not reliable from captured traffic.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx')
  .description(
    'When automatically following a redirected request, the user agent SHOULD resend the original request message with modifications (see RFC 9110).',
  )
  .appliesTo('user-agent')
  .done();
