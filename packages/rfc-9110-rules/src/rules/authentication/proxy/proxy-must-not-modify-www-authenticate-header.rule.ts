import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-not-modify-www-authenticate-header')
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.6.1')
  .description(
    'A proxy forwarding a response MUST NOT modify any WWW-Authenticate header fields in that response.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('www-authenticate'),
      // TODO: This rule requires proxy forwarding test infrastructure
      // For now, we just mark transactions with this header for documentation
      () => false,
    ),
  )
  .done();
