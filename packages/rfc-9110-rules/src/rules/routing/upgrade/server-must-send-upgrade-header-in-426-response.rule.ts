import { and, not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-send-upgrade-header-in-426-response',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server that sends a 426 (Upgrade Required) response MUST send an Upgrade header field to indicate the acceptable protocols, in order of descending preference. This informs the client which protocols it should use.',
  )
  .summary('Server MUST send Upgrade header in 426 response.')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCode(426), not(responseHeader('upgrade'))),
    ),
  )
  .done();
