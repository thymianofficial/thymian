import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/intermediary-must-respond-as-final-recipient-when-max-forward-is-zero',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'If the received Max-Forwards value is zero (0), the intermediary MUST NOT forward the request; instead, the intermediary MUST respond as the final recipient. This prevents infinite forwarding loops in TRACE and OPTIONS requests.',
  )
  .summary(
    'Intermediary MUST respond as final recipient when Max-Forwards is zero.',
  )
  .appliesTo('intermediary')
  .done();
