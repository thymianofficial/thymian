import { not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/user-agent-should-send-user-agent-header')
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A user agent SHOULD send a User-Agent header field in each request unless specifically configured not to do so.',
  )
  .appliesTo('user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(not(requestHeader('user-agent'))),
  )
  .done();
