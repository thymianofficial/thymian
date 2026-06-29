import { and, not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-send-upgrade-header-in-426-response',
)
  .severity('error')
  // Response-side server-behaviour rule needing only the presence of the
  // Upgrade header name, so a single shared check is meaningful across lint
  // (described 426 response), test (live response) and analyze (recorded
  // response) via the common projection. Scoped to 'origin server' as well as
  // 'server' so it also fires on HAR responses (default response role
  // 'origin server').
  .type('static', 'test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server that sends a 426 (Upgrade Required) response MUST send an Upgrade header field to indicate the acceptable protocols, in order of descending preference. This informs the client which protocols it should use.',
  )
  .summary('Server MUST send Upgrade header in 426 response.')
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCode(426), not(responseHeader('upgrade'))),
      // The filter already selects 426 responses that lack an Upgrade header,
      // so every matched transaction is a violation.
      (_req, _res, location) => [
        {
          location,
          violation: {
            message:
              'A 426 (Upgrade Required) response was returned without an Upgrade header field. The server MUST send an Upgrade header listing the acceptable protocol(s) in descending preference.',
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
