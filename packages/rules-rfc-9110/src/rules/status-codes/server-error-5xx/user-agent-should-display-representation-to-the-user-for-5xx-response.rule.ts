import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-should-display-representation-to-the-user-for-5xx-response',
)
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Internal user-agent display behavior; not observable from traffic.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server-error-5xx')
  .description(
    'A user agent SHOULD display any included representation to the user.',
  )
  .appliesTo('user-agent')
  .done();
