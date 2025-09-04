import { and, hasRequestBody, method } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-should-not-generate-content-in-get-request'
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-get')
  .description(
    'A client SHOULD NOT generate content in a HEAD request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported. '
  )
  .summary('A client SHOULD NOT generate content in a HEAD request.')
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(and(method('HEAD'), hasRequestBody()))
  )
  .done();
