import { not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-may-generate-server-header-field',
)
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin server MAY generate a Server header field in its responses.',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(not(responseHeader('server'))),
  )
  .done();
