import { hasResponseBody, not, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-generate-content-for-406-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-406-not-acceptable')
  .description(
    'The server SHOULD generate content containing a list of available representation characteristics and corresponding resource identifiers from which the user or user agent can choose the one most appropriate.',
  )
  .explanation(
    "When a server returns 406 (Not Acceptable) because it cannot meet the request's content-negotiation preferences, it is strongly encouraged to include a response body describing the representations that are available, along with identifiers the client can use to reach them. It matters because a bare 406 leaves the client stuck with no acceptable option; supplying the list of alternatives lets the user or agent pick a workable representation and recover instead of simply failing.",
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(statusCode(406), not(hasResponseBody())),
  )
  .done();
