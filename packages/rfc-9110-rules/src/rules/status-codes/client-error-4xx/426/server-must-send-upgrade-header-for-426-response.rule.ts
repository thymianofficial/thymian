import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-send-upgrade-header-for-426-response',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-426-upgrade-required')
  .description(
    'The server MUST send an Upgrade header field in a 426 response to indicate the required protocol(s).',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(426),
      not(responseHeader('upgrade')),
    ),
  )
  .done();
