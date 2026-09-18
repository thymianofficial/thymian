import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-select-redirection-from-content',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up sends a follow-up request to one of the URI references listed in the 300 content, which a captured trace carries as a later transaction. Matching that target against the list needs the response body parsed for the offered media type, and the hint is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-300-multiple-choices')
  .description(
    'The user agent MAY make a selection from that list automatically if it understands the provided media type.',
  )
  .appliesTo('user-agent')
  .done();
