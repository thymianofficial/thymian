import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-make-own-decision-to-redirect-request-for-3xx-response-to-put-request',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up sends a second request to the Location target of the 3xx, which a captured trace carries as a further transaction after the PUT. The hint — a 3xx answer to a PUT that the agent never followed — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'The user agent MAY then make its own decision regarding whether or not to redirect the request.',
  )
  .appliesTo('user-agent')
  .done();
