import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-change-request-method-from-post-to-get-for-301-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up follows the 301 with a GET where the redirected request was a POST, and a captured trace carries both transactions, so the method of the follow-up sits on the wire next to the method it was derived from. That comparison is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-301-moved-permanently')
  .summary(
    'For historical reasons, a user agent MAY change the request method from POST to GET for the subsequent request.',
  )
  .description(
    'For historical reasons, a user agent MAY change the request method from POST to GET for the subsequent request. If this behavior is undesired, the 308 (Permanent Redirect) status code can be used instead.',
  )
  .appliesTo('user-agent')
  .done();
