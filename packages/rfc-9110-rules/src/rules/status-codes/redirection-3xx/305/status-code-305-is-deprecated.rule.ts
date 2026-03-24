import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/status-code-305-is-deprecated')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-305-use-proxy')
  .description(
    'The 305 (Use Proxy) status code was defined in a previous version of this specification and is now deprecated.',
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(statusCode(305), statusCode(305)),
  )
  .done();
