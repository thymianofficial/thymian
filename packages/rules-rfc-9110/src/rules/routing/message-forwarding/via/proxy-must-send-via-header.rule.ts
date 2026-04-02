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
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCapturedHttpTransactions(
      not(requestHeader('via')),
      ({ request }) => request.meta.role === 'proxy',
    ),
  )
  .done();
