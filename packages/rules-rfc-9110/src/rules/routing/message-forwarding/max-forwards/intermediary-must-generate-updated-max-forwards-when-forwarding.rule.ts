import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-generate-updated-max-forwards-when-forwarding',
)
  .severity('error')
  // OUTCOME 3 (infrastructure-deferred): confirming the forwarded Max-Forwards
  // equals min(received-1, local max) requires correlating the inbound and
  // forwarded request at the intermediary — infra-dependent, not derivable from
  // a single transaction or typical HAR. The before/after linkage is only
  // available from traffic recorded AT the intermediary, so this stays analytics
  // with NO rule function.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    "If the received Max-Forwards value is greater than zero, the intermediary MUST generate an updated Max-Forwards field in the forwarded message with a field value that is the lesser of a) the received value decremented by one (1) or b) the recipient's maximum supported value for Max-Forwards.",
  )
  .summary('Intermediary MUST generate updated Max-Forwards when forwarding.')
  .appliesTo('intermediary')
  .done();
