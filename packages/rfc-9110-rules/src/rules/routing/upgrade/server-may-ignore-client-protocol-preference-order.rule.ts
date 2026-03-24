import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-ignore-client-protocol-preference-order',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY choose to ignore the order of preference indicated by the client and select the new protocol(s) based on other factors, such as the nature of the request or the current load on the server.',
  )
  .summary('Server MAY ignore client protocol preference order.')
  .appliesTo('server')
  .done();
