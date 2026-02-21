import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-associate-quality-value-with-charset',
)
  .severity('hint')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-charset')
  .description(
    "A user agent MAY associate a quality value with each charset to indicate the user's relative preference for that charset, as defined in Section 12.4.2.",
  )
  .appliesTo('user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(requestHeader('accept-charset')),
  )
  .done();
