import { and, not, responseHeader, statusCode } from '@thymian/core';
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
  // Surfaces use of the optional advertising mechanism: the hint fires when a
  // response other than 101/426 (those carry Upgrade per their own MUST rules)
  // carries an Upgrade header, never on its absence.
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(
        responseHeader('upgrade'),
        not(statusCode(101)),
        not(statusCode(426)),
      ),
    ),
  )
  .done();
