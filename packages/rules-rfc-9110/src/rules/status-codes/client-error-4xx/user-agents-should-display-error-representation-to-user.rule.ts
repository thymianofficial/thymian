import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agents-should-display-error-representation-to-user',
)
  .severity('warn')
  // Internal user-agent display behavior; not observable from traffic.
  // Informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-client-error-4xx')
  .description(
    'User agents SHOULD display any included error representation to the user.',
  )
  .appliesTo('user-agent')
  .done();
