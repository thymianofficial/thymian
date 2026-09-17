import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- permissive MAY, server discretion — no hazard in the permission
export default httpRule(
  'rfc9110/server-may-ignore-client-protocol-preference-order',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A permission — honoring the client protocol preference order is optional, so any observed order is compliant.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY choose to ignore the order of preference indicated by the client and select the new protocol(s) based on other factors, such as the nature of the request or the current load on the server.',
  )
  .summary('Server MAY ignore client protocol preference order.')
  .appliesTo('server')
  .done();
