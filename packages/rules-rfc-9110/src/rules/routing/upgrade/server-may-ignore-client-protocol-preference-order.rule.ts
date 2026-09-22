import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- permissive MAY, server discretion — no hazard in the permission
export default httpRule(
  'rfc9110/server-may-ignore-client-protocol-preference-order',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A server that takes this up answers with a 101 whose Upgrade names a protocol other than the first one the client listed, and both the ordered request list and the protocol selected sit in the one transaction that server-must-not-switch-to-non-indicated-protocol already compares. Comparing them by order is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY choose to ignore the order of preference indicated by the client and select the new protocol(s) based on other factors, such as the nature of the request or the current load on the server.',
  )
  .summary('Server MAY ignore client protocol preference order.')
  .appliesTo('server')
  .done();
