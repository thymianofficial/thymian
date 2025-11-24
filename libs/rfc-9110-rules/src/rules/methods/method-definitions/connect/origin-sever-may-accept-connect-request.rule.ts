import { method, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/origin-sever-may-accept-connect-request')
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'An origin server MAY accept a CONNECT request, but most origin servers do not implement CONNECT',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(method('CONNECT'), statusCode(501)),
  )
  .done();
