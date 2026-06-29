import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-not-forward-message-to-itself',
)
  .severity('error')
  // OUTCOME 3 (infrastructure-deferred): detecting a forward-to-self loop
  // requires observing the intermediary's own routing decision and recognizing
  // its own names/aliases/IPs across the inbound and forwarded messages —
  // infra-dependent trace data recorded at the intermediary, not derivable from
  // a single transaction or typical HAR. Stays analytics scoped to intermediary,
  // with NO rule function because verification requires correlating the
  // intermediary's inbound and outbound messages (a before/after linkage only
  // available from traffic recorded AT the intermediary).
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
