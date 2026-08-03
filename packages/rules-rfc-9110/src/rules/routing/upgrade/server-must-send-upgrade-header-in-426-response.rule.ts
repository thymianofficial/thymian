import { and, not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-send-upgrade-header-in-426-response',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server that sends a 426 (Upgrade Required) response MUST send an Upgrade header field to indicate the acceptable protocols, in order of descending preference. This informs the client which protocols it should use.',
  )
  .summary('Server MUST send Upgrade header in 426 response.')
  .explanation(
    'A 426 (Upgrade Required) response must include an Upgrade header listing the acceptable protocols in order of preference. The 426 status tells the client its current protocol is not allowed and it must upgrade; the Upgrade header tells it what to upgrade to. It matters because without that list the client knows only that it must change protocols but has no idea which ones the server will accept, so it cannot complete the request.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCode(426), not(responseHeader('upgrade'))),
      // The filter already selects 426 responses that lack an Upgrade header,
      // so every matched transaction is a violation.
      (_req, _res, location) => [{ location, violation: {}, findings: [] }],
    ),
  )
  .done();
