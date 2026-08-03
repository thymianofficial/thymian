import { not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/user-agent-should-send-user-agent-header')
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A user agent SHOULD send a User-Agent header field in each request unless specifically configured not to do so.',
  )
  .explanation(
    'Your client should identify itself by including a User-Agent header on every request, naming the software (and usually its version) making the call, unless it has been deliberately configured to stay anonymous. This matters because servers rely on that identifier to scope interoperability problems to specific clients, to work around known client limitations, and to gather analytics on browser and platform usage; without it, operators lose an important signal for diagnosing and tailoring responses.',
  )
  .appliesTo('user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(not(requestHeader('user-agent'))),
  )
  .done();
