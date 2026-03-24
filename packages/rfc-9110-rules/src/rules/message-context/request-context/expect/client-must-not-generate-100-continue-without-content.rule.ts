import { and, hasRequestBody, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-not-generate-100-continue-without-content',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client MUST NOT generate a 100-continue expectation in a request that does not include content.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(requestHeader('expect', '100-continue'), not(hasRequestBody())),
    ),
  )
  .done();
