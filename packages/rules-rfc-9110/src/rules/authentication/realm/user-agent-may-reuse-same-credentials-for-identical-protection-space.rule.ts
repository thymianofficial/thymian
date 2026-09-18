import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-reuse-same-credentials-for-identical-protection-space',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up repeats the same Authorization credentials on later requests to the same protection space, and a captured trace carries those as further transactions alongside the challenge that established it. The space is delimited on the wire rather than inside the agent: it is the origin plus the realm the server named in its own challenge. The `hint` — a client re-authenticated from scratch on every request inside one protection space — is not written yet.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-establishing-a-protection-s',
  )
  .description(
    'If a prior request has been authorized, the user agent MAY reuse the same credentials for all other requests within that protection space for a period of time determined by the authentication scheme, parameters, and/or user preferences (such as a configurable inactivity timeout).',
  )
  .appliesTo('user-agent')
  .done();
