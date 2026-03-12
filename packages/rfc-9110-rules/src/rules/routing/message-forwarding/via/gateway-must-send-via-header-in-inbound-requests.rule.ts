import { not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/gateway-must-send-via-header-in-inbound-requests',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'An HTTP-to-HTTP gateway MUST send an appropriate Via header field in each inbound request message. This enables tracking of the message path and protocol capabilities along the request/response chain.',
  )
  .summary('Gateway MUST send Via header in inbound requests.')
  .appliesTo('gateway')
  .rule((ctx) =>
    ctx.validateCapturedHttpTransactions(
      not(requestHeader('via')),
      ({ request }) => request.meta.role === 'gateway',
    ),
  )
  .done();
