import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-send-upgrade-header-in-other-responses',
)
  .severity('hint')
  // Informational (outcome 2): a pure permission ("MAY send Upgrade in any
  // other response") with no non-conformant condition. The previous
  // implementation flagged every response lacking an Upgrade header as a
  // finding, which is incorrect — omitting an optional advertisement is not a
  // violation. Nothing is observable as conformant/non-conformant, so the rule
  // is reclassified to informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY send an Upgrade header field in any other response to advertise that it implements support for upgrading to the listed protocols, in order of descending preference, when appropriate for a future request.',
  )
  .summary('Server MAY send Upgrade header in responses to advertise support.')
  .appliesTo('server', 'origin server')
  .done();
