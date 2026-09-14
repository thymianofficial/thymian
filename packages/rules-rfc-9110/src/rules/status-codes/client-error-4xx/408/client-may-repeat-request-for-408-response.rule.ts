import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/client-may-repeat-request-for-408-response')
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A MAY describing an internal client retry decision; no non-conformant condition to observe.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-408-request-timeout')
  .description(
    'If the client has an outstanding request in transit, it MAY repeat that request.',
  )
  .appliesTo('client')
  .done();
