import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/402-status-code-is-reserved')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-402-payment-required')
  .description(
    'The 402 (Payment Required) status code is reserved for future use.',
  )
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(402)))
  .done();
