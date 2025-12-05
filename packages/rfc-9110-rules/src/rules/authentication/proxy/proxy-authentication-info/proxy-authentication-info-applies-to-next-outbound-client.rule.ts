import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-authentication-info-applies-to-next-outbound-client',
)
  .severity('hint')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-11.7.3')
  .description(
    'However, unlike Authentication-Info, the Proxy-Authentication-Info header field applies only to the next outbound client on the response chain.',
  )
  .appliesTo('proxy')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      responseHeader('proxy-authentication-info'),
      // This is informational - documents expected behavior
      // Not a violation
      () => false,
    ),
  )
  .done();
