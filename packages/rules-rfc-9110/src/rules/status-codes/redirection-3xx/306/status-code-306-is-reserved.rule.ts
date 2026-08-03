import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/status-code-306-is-reserved')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-306-unused')
  .description(
    'The 306 status code was defined in a previous version of this specification, is no longer used, and the code is reserved.',
  )
  .explanation(
    'Do not send the 306 status code; it was defined in an earlier version of HTTP, is no longer used, and the code number is now reserved so it carries no defined meaning. This matters because clients have no interoperable behavior for it, and reusing a reserved code invites confusion. Pick a currently defined status code that actually describes the response you intend.',
  )
  .appliesTo('server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(306)))
  .done();
