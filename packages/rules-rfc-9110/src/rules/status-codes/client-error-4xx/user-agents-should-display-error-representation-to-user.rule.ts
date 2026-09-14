import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agents-should-display-error-representation-to-user',
)
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Internal user-agent display behavior; not observable from traffic.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-client-error-4xx')
  .description(
    'User agents SHOULD display any included error representation to the user.',
  )
  .appliesTo('user-agent')
  .done();
