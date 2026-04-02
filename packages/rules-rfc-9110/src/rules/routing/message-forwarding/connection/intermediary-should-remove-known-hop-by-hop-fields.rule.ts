import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-should-remove-known-hop-by-hop-fields',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    "Intermediaries SHOULD remove or replace fields that are known to require removal before forwarding, whether or not they appear as a connection-option, after applying those fields' semantics. This includes but is not limited to: Proxy-Connection, Keep-Alive, TE, Transfer-Encoding, and Upgrade.",
  )
  .summary('Intermediary SHOULD remove known hop-by-hop fields.')
  .appliesTo('intermediary')
  .done();
