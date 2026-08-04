import { method, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-server-may-accept-connect-request')
  .severity('hint')
  .type('test', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'An origin server MAY accept a CONNECT request, but most origin servers do not implement CONNECT',
  )
  .explanation(
    'CONNECT is intended for proxies to open a tunnel to a destination, so it is optional for an origin server: an origin server may accept it, but most do not implement it and will report it as not implemented. This is informational rather than a hard requirement, and it sets expectations for clients: since CONNECT targets proxies, sending it directly to an origin server usually will not establish a tunnel, so clients should not assume plain origin servers support it.',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(method('CONNECT'), statusCode(501)),
  )
  .done();
