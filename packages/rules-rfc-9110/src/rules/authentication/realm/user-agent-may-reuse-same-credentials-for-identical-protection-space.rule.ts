import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-reuse-same-credentials-for-identical-protection-space',
)
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A permissive MAY describing user-agent-internal state: once authorized, the user agent may reuse the same credentials within the protection space for a self-chosen duration. Both reusing and not reusing are conformant, and the protection space is user-agent-internal.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-establishing-a-protection-s',
  )
  .description(
    'If a prior request has been authorized, the user agent MAY reuse the same credentials for all other requests within that protection space for a period of time determined by the authentication scheme, parameters, and/or user preferences (such as a configurable inactivity timeout).',
  )
  .appliesTo('user-agent')
  .done();
