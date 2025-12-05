import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-must-not-modify-authentication-info-header',
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.6.3')
  .description(
    'A proxy forwarding a response is not allowed to modify the Authentication-Info field value in any way.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('authentication-info'),
      // TODO: This rule requires proxy forwarding test infrastructure
      // For now, we just mark transactions with this header for documentation
      () => false,
    ),
  )
  .done();
