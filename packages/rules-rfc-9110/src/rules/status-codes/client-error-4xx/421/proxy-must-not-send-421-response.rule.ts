import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-send-421-response')
  .severity('error')
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-421-misdirected-request',
  )
  .description('A proxy MUST NOT generate a 421 response.')
  .appliesTo('proxy')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(421)))
  .done();
