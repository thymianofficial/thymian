import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-not-forward-when-max-forwards-is-zero',
)
  .severity('error')
  // OUTCOME 3 (infrastructure-deferred): detecting that the intermediary did NOT
  // forward when Max-Forwards was 0 requires observing the absence of an outbound
  // forward AND that the intermediary answered directly — intermediary-recorded
  // trace data correlating inbound and outbound messages, not derivable from a
  // single transaction or typical HAR. Stays analytics with NO rule function.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'If the received Max-Forwards value is zero (0), the intermediary MUST NOT forward the request; instead, the intermediary MUST respond as the final recipient. This prevents infinite forwarding loops in TRACE and OPTIONS requests.',
  )
  .summary('Intermediary MUST NOT forward request when Max-Forwards is zero.')
  .appliesTo('intermediary')
  .done();
