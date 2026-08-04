import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/402-status-code-is-reserved')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-402-payment-required')
  .description(
    'The 402 (Payment Required) status code is reserved for future use.',
  )
  .explanation(
    'The 402 status code has no defined meaning in HTTP; the spec reserves it for future use rather than assigning it a behavior. In practice this means a server should not rely on 402 to convey a standard, interoperable meaning, since clients have no agreed way to interpret it. Using it risks inconsistent handling across clients and proxies and may conflict with whatever semantics a future revision of the standard eventually assigns.',
  )
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(402)))
  .done();
