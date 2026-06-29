import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-interpret-missing-port-as-default',
)
  .severity('hint')
  // Pure permission describing an internal recipient interpretation (treating a
  // missing Via port as the protocol default). The interpretation is internal
  // to the recipient and leaves no observable trace in the message.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'If a port is not provided in the Via header field, a recipient MAY interpret that as meaning it was received on the default port, if any, for the received-protocol.',
  )
  .summary(
    'Recipient MAY interpret missing port as default port in Via header.',
  )
  .done();
