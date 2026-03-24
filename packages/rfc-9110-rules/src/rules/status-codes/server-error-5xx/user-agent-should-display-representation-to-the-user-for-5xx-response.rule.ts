import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-display-representation-to-the-user-for-5xx-response',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server-error-5xx')
  .description(
    'A user agent SHOULD display any included representation to the user.',
  )
  .appliesTo('user-agent')
  .done();
