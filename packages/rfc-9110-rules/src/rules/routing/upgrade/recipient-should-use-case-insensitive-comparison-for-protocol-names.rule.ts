import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/recipient-should-use-case-insensitive-comparison-for-protocol-names',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'Although protocol names are registered with a preferred case, recipients SHOULD use case-insensitive comparison when matching each protocol-name to supported protocols. This ensures compatibility despite variations in protocol name casing.',
  )
  .summary(
    'Recipient SHOULD use case-insensitive comparison for protocol names.',
  )
  .done();
