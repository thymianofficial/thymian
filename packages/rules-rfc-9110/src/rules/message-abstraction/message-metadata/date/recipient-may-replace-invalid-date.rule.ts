import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/recipient-may-replace-invalid-date')
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A MAY describing internal recipient behavior (replacing an invalid Date value with reception time); a local processing choice with no non-conformant condition observable in the transaction.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'A recipient with a clock that receives a response with an invalid Date header field value MAY replace that value with the time that response was received.',
  )
  .summary(
    'Recipients with a clock MAY replace invalid Date header with reception time.',
  )
  .done();
