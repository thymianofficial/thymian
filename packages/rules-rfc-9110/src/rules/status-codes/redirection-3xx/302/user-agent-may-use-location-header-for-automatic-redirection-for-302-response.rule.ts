import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-use-location-header-for-automatic-redirection-for-302-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up sends a follow-up request to the Location value of the 302, which a captured trace carries as a later transaction whose target is that URI. The hint — a 302 whose Location was never followed — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-302-found')
  .summary(
    'The user agent MAY use the Location field value for automatic redirection.',
  )
  .description(
    "The user agent MAY use the Location field value for automatic redirection. The server's response content usually contains a short hypertext note with a hyperlink to the different URI(s).",
  )
  .appliesTo('user-agent')
  .done();
