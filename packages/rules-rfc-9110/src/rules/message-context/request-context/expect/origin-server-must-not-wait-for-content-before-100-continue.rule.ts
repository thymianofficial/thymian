import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-must-not-wait-for-content-before-100-continue',
)
  .severity('hint')
  .type(
    'informational',
    'peer-internal-behaviour',
    'A timing/ordering requirement on the origin server with no signature in the response message; not observable from traffic.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'The origin server MUST NOT wait for the content before sending the 100 (Continue) response.',
  )
  .appliesTo('origin server')
  .done();
