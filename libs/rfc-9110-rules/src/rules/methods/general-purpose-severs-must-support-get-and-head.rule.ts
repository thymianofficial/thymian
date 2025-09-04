import { method, not, or, statusCode } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/general-purpose-severs-must-support-get-and-head'
)
  .severity('error')
  .type('test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'All general-purpose servers MUST support the methods GET and HEAD.'
  )
  .appliesTo('server')
  .rule(ctx => ctx.validateCommonHttpTransactions(
    or(method('get'), method('head')),
    not(statusCode(501))
  ))
  .done();
