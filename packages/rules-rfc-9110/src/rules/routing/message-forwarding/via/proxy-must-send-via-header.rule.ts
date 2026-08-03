import { not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-send-via-header')
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A proxy MUST send an appropriate Via header field in each message that it forwards. The Via header field indicates the presence of intermediate protocols and recipients between the user agent and the server, and is used for tracking message forwards, avoiding request loops, and identifying protocol capabilities.',
  )
  .summary('Proxy MUST send Via header in forwarded messages.')
  .explanation(
    'Every time a proxy forwards a message, it must append its own entry to the Via header so the header lists each intermediary the message passed through, in order, together with the protocol versions involved. This trail is what lets operators trace the forwarding path, spot and stop request loops, and see the protocol capabilities of senders along the chain. A proxy that forwards without adding Via breaks that record and hides its presence from downstream recipients.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTransactions(
      not(requestHeader('via')),
      (transaction, location) =>
        transaction.request.meta.role === 'proxy'
          ? [{ location, violation: {}, findings: [] }]
          : [],
    ),
  )
  .done();
