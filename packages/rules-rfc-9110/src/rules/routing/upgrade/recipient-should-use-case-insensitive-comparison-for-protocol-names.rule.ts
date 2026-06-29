import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-use-case-insensitive-comparison-for-protocol-names',
)
  .severity('warn')
  // Governs an internal recipient algorithm: how a recipient compares received
  // protocol names against its own supported set. That comparison is entirely
  // internal to the recipient and leaves no observable trace in the request, the
  // live response, or recorded traffic, so no context can validate conformance.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'Although protocol names are registered with a preferred case, recipients SHOULD use case-insensitive comparison when matching each protocol-name to supported protocols. This ensures compatibility despite variations in protocol name casing.',
  )
  .summary(
    'Recipient SHOULD use case-insensitive comparison for protocol names.',
  )
  .done();
