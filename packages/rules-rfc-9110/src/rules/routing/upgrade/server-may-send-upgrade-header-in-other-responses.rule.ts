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
  .explanation(
    'A server is permitted to include an Upgrade header on ordinary responses, not just on 101 or 426, to advertise which protocols it can switch to (in order of preference) for a future request. This is optional. It matters because it lets a server hint at its upgrade capabilities ahead of time, so a client can decide whether to attempt an upgrade on a later request instead of guessing or making a wasted round trip.',
  )
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
