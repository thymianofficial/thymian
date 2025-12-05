import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-not-modify-authorization-header')
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.6.2')
  .description(
    'A proxy forwarding a request MUST NOT modify any Authorization header fields in that request.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      requestHeader('authorization'),
      // TODO: This rule requires proxy forwarding test infrastructure
      // For now, we just mark transactions with this header for documentation
      () => false,
    ),
  )
  .done();
