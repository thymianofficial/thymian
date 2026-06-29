import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-parse-and-remove-connection-fields',
)
  .severity('error')
  // Infrastructure-deferred (outcome 3): conformance requires observing the
  // message BOTH as received by the intermediary and as forwarded by it, then
  // confirming the connection-option-named fields (and Connection itself) were
  // stripped on the outbound side. That before/after linkage is only available
  // from traffic recorded at the intermediary; it is not reconstructable from a
  // single transaction or a typical HAR. The rule therefore stays typed
  // `analytics` and scoped to the `intermediary` role, deferred to such a
  // capture, rather than being downgraded to informational. No rule function is
  // shipped because the framework cannot correlate the inbound/outbound pair
  // for a generic capture today.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    "Intermediaries MUST parse a received Connection header field before a message is forwarded and, for each connection-option in this field, remove any header or trailer field(s) from the message with the same name as the connection-option, and then remove the Connection header field itself (or replace it with the intermediary's own control options for the forwarded message).",
  )
  .summary(
    'Intermediary MUST parse and remove Connection fields before forwarding.',
  )
  .appliesTo('intermediary')
  .done();
