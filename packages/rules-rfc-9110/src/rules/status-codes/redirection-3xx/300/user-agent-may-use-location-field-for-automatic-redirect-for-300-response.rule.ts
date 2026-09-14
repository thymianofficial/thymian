import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-use-location-field-for-automatic-redirect',
)
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A MAY describing internal user-agent redirect behavior; no non-conformant condition to observe.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-300-multiple-choices')
  .description(
    'The user agent MAY use the Location field value for automatic redirection.',
  )
  .appliesTo('user-agent')
  .done();
