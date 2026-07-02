import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-not-forward-when-max-forwards-is-zero',
)
  .severity('error')
  // Detecting that an intermediary forwarded despite a received
  // Max-Forwards of zero requires observing an inbound request with value 0 AND a
  // corresponding forwarded request at the same hop. That per-hop correlation is only
  // recoverable from captured multi-hop traces where the intermediary role is recorded.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'If the received Max-Forwards value is zero (0), the intermediary MUST NOT forward the request; instead, the intermediary MUST respond as the final recipient. This prevents infinite forwarding loops in TRACE and OPTIONS requests.',
  )
  .summary('Intermediary MUST NOT forward request when Max-Forwards is zero.')
  .appliesTo('intermediary')
  .done();
