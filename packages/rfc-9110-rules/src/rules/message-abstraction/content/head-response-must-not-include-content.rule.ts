import { and, hasResponseBody, method } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/head-response-must-not-include-content')
  .severity('error')
  .type('static', 'analytics', 'test')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.1')
  .description(
    'Responses to the HEAD request method never include content; the associated response header fields indicate only what their values would have been if the request method had been GET.',
  )
  .summary('Responses to HEAD requests MUST NOT include content.')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(and(method('HEAD'), hasResponseBody())),
  )
  .done();
