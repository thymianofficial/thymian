import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-reuse-same-credentials-for-identical-protection-space',
)
  .severity('hint')
  // A permissive MAY describing user-agent-internal state — once a request is
  // authorized, the user agent is allowed (but not required) to reuse the same
  // credentials for other requests in the same protection space, for a duration
  // of its own choosing. Both reusing and not reusing are conformant, the
  // duration is implementation-defined, and the protection space is
  // user-agent-internal, so there is no observable non-conformant condition to
  // validate.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-establishing-a-protection-s',
  )
  .description(
    'If a prior request has been authorized, the user agent MAY reuse the same credentials for all other requests within that protection space for a period of time determined by the authentication scheme, parameters, and/or user preferences (such as a configurable inactivity timeout).',
  )
  .appliesTo('user-agent')
  .done();
