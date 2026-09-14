import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-use-location-header-for-automatic-redirection-for-301-response',
)
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A MAY describing internal user-agent redirect behavior; no non-conformant condition to observe.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-301-moved-permanently')
  .summary(
    'The user agent MAY use the Location field value for automatic redirection.',
  )
  .description(
    "The user agent MAY use the Location field value for automatic redirection. The server's response content usually contains a short hypertext note with a hyperlink to the new URI(s).",
  )
  .appliesTo('user-agent')
  .done();
