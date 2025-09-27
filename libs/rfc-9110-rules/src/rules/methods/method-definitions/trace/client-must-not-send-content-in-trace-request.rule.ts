import { hasRequestBody, method } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-must-not-send-content-in-trace-request')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description('A client MUST NOT send content in a TRACE request.')
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(method('TRACE'), hasRequestBody()),
  )
  .done();
