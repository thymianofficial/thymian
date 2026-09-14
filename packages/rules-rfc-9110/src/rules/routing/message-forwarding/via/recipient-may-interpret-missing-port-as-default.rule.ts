import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- internal parsing interpretation with no observable artifact
export default httpRule(
  'rfc9110/recipient-may-interpret-missing-port-as-default',
)
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A permission — interpreting an absent Via port as the default is an internal recipient decision with no observable artifact either way.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'If a port is not provided in the Via header field, a recipient MAY interpret that as meaning it was received on the default port, if any, for the received-protocol.',
  )
  .summary(
    'Recipient MAY interpret missing port as default port in Via header.',
  )
  .done();
