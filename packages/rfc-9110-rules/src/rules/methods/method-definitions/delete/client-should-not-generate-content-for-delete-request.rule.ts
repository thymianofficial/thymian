import { hasRequestBody, method } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-not-generate-content-for-delete-request',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-delete')
  .description(
    'A client SHOULD NOT generate content in a DELETE request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(method('DELETE'), hasRequestBody()),
  )
  .done();
