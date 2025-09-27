import { method, not, or, statusCode } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/other-methods-than-get-and-head-are-optional')
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description('Other methods than GET and HEAD are OPTIONAL.')
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      not(or(method('GET'), method('HEAD'))),
      statusCode(501),
    ),
  )
  .done();
