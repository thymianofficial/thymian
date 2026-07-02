import { and, not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

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
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCode(101), not(responseHeader('upgrade'))),
      // The filter already selects 101 responses that lack an Upgrade header,
      // so every matched transaction is a violation.
      (_req, _res, location) => [
        {
          location,
          violation: {
            message:
              'A 101 (Switching Protocols) response was returned without an Upgrade header field. The server MUST send an Upgrade header to indicate the protocol(s) the connection is being switched to.',
          },
          findings: [],
        },
      ],
    ),
  )
  .done();
