import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/protection-space-cannot-extend-beyond-origin')
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-establishing-a-protection-s',
  )
  .description(
    'If a prior request has been authorized, the user agent MAY reuse the same credentials for all other requests within that protection space for a period of time determined by the authentication scheme, parameters, and/or user preferences (such as a configurable inactivity timeout).',
  )
  .appliesTo('user-agent')
  .done();
