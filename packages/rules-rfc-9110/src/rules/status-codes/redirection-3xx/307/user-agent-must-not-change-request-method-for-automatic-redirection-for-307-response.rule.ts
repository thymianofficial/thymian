import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-must-not-change-request-method-for-automatic-redirection-for-307-response',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Constrains how a user agent constructs an automatic follow-up request. Reliably attributing a later request to an automatic 307 redirect (vs a fresh user action) is internal to the user agent and not possible from captured traffic.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-307-temporary-redirect',
  )
  .description(
    'The 307 (Temporary Redirect) status code indicates that the target resource resides temporarily under a different URI and the user agent MUST NOT change the request method if it performs an automatic redirection to that URI.',
  )
  .appliesTo('user-agent')
  .done();
