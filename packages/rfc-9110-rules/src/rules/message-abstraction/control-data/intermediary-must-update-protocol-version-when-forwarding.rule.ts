import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/intermediary-must-update-protocol-version-when-forwarding',
)
  .severity('error')
  .type('analytics', 'informational')
  .appliesTo('intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    'When a message is forwarded by an intermediary, the protocol version is updated to reflect the version used by that intermediary. The Via header field (Section 7.6.3) is used to communicate upstream protocol information within a forwarded message.',
  )
  .summary(
    'Intermediaries MUST update protocol version when forwarding messages.',
  )
  .done();
