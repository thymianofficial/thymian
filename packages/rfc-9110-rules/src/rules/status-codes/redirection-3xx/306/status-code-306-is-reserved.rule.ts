import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/status-code-306-is-reserved')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-306-unused')
  .description(
    'The 306 status code was defined in a previous version of this specification, is no longer used, and the code is reserved.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(statusCode(306), statusCode(306)),
  )
  .done();
