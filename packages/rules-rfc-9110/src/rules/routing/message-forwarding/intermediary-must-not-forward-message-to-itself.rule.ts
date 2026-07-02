import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-not-forward-message-to-itself',
)
  .severity('error')
  // Detecting an intermediary forwarding a message to itself requires
  // recognizing the same node as both sender and next-hop recipient across a forwarding
  // chain. That per-hop identity correlation is only recoverable from captured multi-hop
  // traces at a deployment where the intermediary role and its addresses are recorded.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-message-forwarding')
  .description(
    'An intermediary MUST NOT forward a message to itself unless it is protected from an infinite request loop. In general, an intermediary ought to recognize its own server names, including any aliases, local variations, or literal IP addresses, and respond to such requests directly.',
  )
  .summary(
    'Intermediary MUST NOT forward message to itself without loop protection.',
  )
  .appliesTo('intermediary')
  .done();
