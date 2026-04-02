import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-inherit-fragment-for-3xx-without-fragment',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-location')
  .description(
    "If the Location value provided in a 3xx (Redirection) response does not have a fragment component, a user agent MUST process the redirection as if the value inherits the fragment component of the URI reference used to generate the target URI (i.e., the redirection inherits the original reference's fragment, if any).",
  )
  .summary(
    'A user agent MUST process the redirection as if the value inherits the fragment component of the URI reference used to generate the target URI',
  )
  .appliesTo('user-agent')
  .done();
