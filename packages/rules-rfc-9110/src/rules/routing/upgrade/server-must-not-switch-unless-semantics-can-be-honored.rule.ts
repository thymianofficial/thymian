import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-switch-unless-semantics-can-be-honored',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MUST NOT switch protocols unless the received message semantics can be honored by the new protocol. An OPTIONS request can be honored by any protocol. This allows a connection to be upgraded to protocols with the same semantics as HTTP without the latency cost of an additional round trip.',
  )
  .summary('Server MUST NOT switch unless message semantics can be honored.')
  .appliesTo('server')
  .done();
