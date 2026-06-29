import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-should-remove-known-hop-by-hop-fields',
)
  .severity('warn')
  // Infrastructure-deferred (outcome 3): like the parse-and-remove rule, this
  // is about what an intermediary STRIPS before forwarding (Proxy-Connection,
  // Keep-Alive, TE, Transfer-Encoding, Upgrade, ...). Verifying it requires
  // correlating the inbound message with the intermediary's outbound message
  // and confirming the hop-by-hop fields were removed — a before/after linkage
  // only available from traffic recorded at the intermediary, not from a single
  // transaction or a typical HAR. It therefore stays typed `analytics`, scoped
  // to the `intermediary` role and deferred to such a capture, with no rule
  // function until the framework can correlate the inbound/outbound pair.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    "Intermediaries SHOULD remove or replace fields that are known to require removal before forwarding, whether or not they appear as a connection-option, after applying those fields' semantics. This includes but is not limited to: Proxy-Connection, Keep-Alive, TE, Transfer-Encoding, and Upgrade.",
  )
  .summary('Intermediary SHOULD remove known hop-by-hop fields.')
  .appliesTo('intermediary')
  .done();
