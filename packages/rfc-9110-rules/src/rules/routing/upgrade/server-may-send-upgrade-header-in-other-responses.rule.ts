import { not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-send-upgrade-header-in-other-responses',
)
  .severity('hint')
  .type('analytics', 'static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY send an Upgrade header field in any other response to advertise that it implements support for upgrading to the listed protocols, in order of descending preference, when appropriate for a future request.',
  )
  .summary('Server MAY send Upgrade header in responses to advertise support.')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(not(responseHeader('upgrade'))),
  )
  .done();
