import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-not-send-from-without-configuration',
)
  .severity('warn')
  // Request-side rule (#327). `test` dropped: Thymian generates the request, so
  // it cannot exercise the case of an unconfigured From. The "without explicit
  // configuration" condition is itself unobservable, so the honest, identical
  // check across `static` (described request) and `analytics` (recorded
  // request) is header *presence*, which the common projection provides. A
  // single shared filter-only rule covers both.
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-from')
  .description(
    "A user agent SHOULD NOT send a From header field without explicit configuration by the user, since that might conflict with the user's privacy interests or their site's security policy.",
  )
  .appliesTo('user-agent')
  .rule((ctx) => ctx.validateCommonHttpTransactions(requestHeader('from')))
  .done();
