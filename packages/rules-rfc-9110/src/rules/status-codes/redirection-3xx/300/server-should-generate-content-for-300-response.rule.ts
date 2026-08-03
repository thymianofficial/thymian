import { and, hasResponseBody, method, not, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-generate-content-for-300-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-300-multiple-choices')
  .description(
    'For request methods other than HEAD, the server SHOULD generate content in the 300 response containing a list of representation metadata and URI reference(s) from which the user or user agent can choose the one most preferred.',
  )
  .explanation(
    'When a server returns 300 to say the resource has several alternative representations, its response body (for anything other than a HEAD request) should list those alternatives with their metadata and URIs so the user or client can pick the one they want. This matters because 300 exists to let the client choose; without a body listing the options there is nothing to choose from, and the response gives the client no way to proceed.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(not(method('HEAD')), statusCode(300)),
      not(hasResponseBody()),
    ),
  )
  .done();
