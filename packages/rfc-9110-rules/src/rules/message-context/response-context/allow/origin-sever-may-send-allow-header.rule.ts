import { not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/origin-sever-may-send-allow-header')
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description('Origin server MAY send "Allow" header field in response.')
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(not(responseHeader('allow'))),
  )
  .done();
