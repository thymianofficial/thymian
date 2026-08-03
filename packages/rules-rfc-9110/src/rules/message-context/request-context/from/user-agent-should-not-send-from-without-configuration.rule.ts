import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-not-send-from-without-configuration',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-from')
  .description(
    "A user agent SHOULD NOT send a From header field without explicit configuration by the user, since that might conflict with the user's privacy interests or their site's security policy.",
  )
  .explanation(
    "Do not attach a From header (a human user's email address) to requests unless the user has explicitly configured you to do so. The From value is expected to be visible to anyone observing the request and is routinely written to logs and error reports without any expectation of privacy, so sending it automatically leaks a personal identifier and can violate the user's privacy interests or their site's security policy.",
  )
  .appliesTo('user-agent')
  .rule((ctx) => ctx.validateCommonHttpTransactions(requestHeader('from')))
  .done();
