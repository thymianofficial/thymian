import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-consume-proxy-authorization-header')
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.7.2')
  .description(
    'Unlike Authorization, the Proxy-Authorization header field applies only to the next inbound proxy that demanded authentication. A proxy should consume Proxy-Authorization headers intended for them and not forward them to the next proxy, unless proxies cooperatively authenticate.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      requestHeader('proxy-authorization'),
      // TODO: This rule requires proxy forwarding test infrastructure
      // For now, we just mark transactions with this header for documentation
      () => false,
    ),
  )
  .done();
