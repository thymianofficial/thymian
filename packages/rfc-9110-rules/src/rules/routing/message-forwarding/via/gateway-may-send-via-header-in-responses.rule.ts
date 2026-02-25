import { not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/gateway-may-send-via-header-in-responses')
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'An HTTP-to-HTTP gateway MAY send a Via header field in forwarded response messages. This is optional for responses, unlike requests where it is required.',
  )
  .summary('Gateway MAY send Via header in forwarded responses.')
  .appliesTo('gateway')
  .rule((ctx) =>
    ctx.validateCapturedHttpTransactions(
      not(requestHeader('via')),
      ({ response }) => response.meta.role === 'gateway',
    ),
  )
  .done();
