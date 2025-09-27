import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-must-not-change-request-method-for-automatic-redirection-for-307-response',
)
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-307-temporary-redirect',
  )
  .description(
    'The 307 (Temporary Redirect) status code indicates that the target resource resides temporarily under a different URI and the user agent MUST NOT change the request method if it performs an automatic redirection to that URI.',
  )
  .appliesTo('user-agent')
  .done();
