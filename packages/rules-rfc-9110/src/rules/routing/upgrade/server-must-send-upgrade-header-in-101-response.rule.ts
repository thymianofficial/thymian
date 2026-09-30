import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- protocol-disclosure the client needs to function, not a concern this vocabulary covers
export default httpRule(
  'rfc9110/server-must-send-upgrade-header-in-101-response',
)
  .severity('error')
  // 101 (Switching Protocols) is an interim response absent from the static spec
  // projection, because schemas do not model interim responses.
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server that sends a 101 (Switching Protocols) response MUST send an Upgrade header field to indicate the new protocol(s) to which the connection is being switched. This informs the client which protocol is now in use.',
  )
  .summary('Server MUST send Upgrade header in 101 response.')
  .explanation(
    'A 101 (Switching Protocols) response must always carry an Upgrade header naming the protocol or protocols the connection is switching to. The 101 status only says a switch is happening; the Upgrade header says which protocol. It matters because without it the client is told the connection has changed but has no way to know what to speak next, leaving both ends out of sync and the connection unusable.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: statusCode(101),
      violatedWhen: not(responseHeader('upgrade')),
    }),
  )
  .done();
