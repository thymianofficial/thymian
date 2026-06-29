import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-must-inherit-fragment-for-3xx-without-fragment',
)
  .severity('hint')
  // Informational (#327): a MUST governing the user agent's *internal*
  // processing of a redirect (how it reconstructs the target's fragment). This
  // is recipient-side behaviour that produces no observable signal in the
  // request/response messages, so there is no detectable non-conformant case.
  // No rule function.
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
