import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/gateway-may-send-via-header-in-responses')
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'An HTTP-to-HTTP gateway MAY send a Via header field in forwarded response messages. This is optional for responses, unlike requests where it is required.',
  )
  .summary('Gateway MAY send Via header in forwarded responses.')
  .appliesTo('gateway')
  // Surfaces use of the optional mechanism: the hint fires when a gateway
  // response carries a Via header, never on its absence. It runs on captured
  // transactions and gates on the response role so the origin server's own Via
  // on the gateway's upstream leg is not misattributed to the gateway.
  .rule((ctx) =>
    ctx.validateCapturedHttpTransactions(
      responseHeader('via'),
      (transaction, location) =>
        transaction.response.meta.role === 'gateway'
          ? [{ location, violation: {}, findings: [] }]
          : [],
    ),
  )
  .done();
