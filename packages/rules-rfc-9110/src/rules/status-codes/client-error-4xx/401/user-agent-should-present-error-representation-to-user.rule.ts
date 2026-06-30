import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-present-error-representation-to-user',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .description(
    'If the 401 response contains the same challenge as the prior response, and the user agent has already attempted authentication at least once, then the user agent SHOULD present the enclosed representation to the user, since it usually contains relevant diagnostic information.',
  )
  .appliesTo('user-agent')
  .done();
