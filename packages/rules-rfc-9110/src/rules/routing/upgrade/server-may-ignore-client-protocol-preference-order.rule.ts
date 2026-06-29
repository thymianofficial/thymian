import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-ignore-client-protocol-preference-order',
)
  .severity('hint')
  // Pure permission (MAY) describing an internal server selection decision.
  // Ignoring the client's preference order is explicitly allowed, so there is no
  // non-conformant condition to detect, and the selection criteria are
  // server-internal and unobservable.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY choose to ignore the order of preference indicated by the client and select the new protocol(s) based on other factors, such as the nature of the request or the current load on the server.',
  )
  .summary('Server MAY ignore client protocol preference order.')
  .appliesTo('server')
  .done();
