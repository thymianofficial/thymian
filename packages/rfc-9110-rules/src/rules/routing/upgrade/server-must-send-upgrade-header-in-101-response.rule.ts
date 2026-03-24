import { and, not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-send-upgrade-header-in-101-response',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server that sends a 101 (Switching Protocols) response MUST send an Upgrade header field to indicate the new protocol(s) to which the connection is being switched. This informs the client which protocol is now in use.',
  )
  .summary('Server MUST send Upgrade header in 101 response.')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(statusCode(101), not(responseHeader('upgrade'))),
    ),
  )
  .done();
