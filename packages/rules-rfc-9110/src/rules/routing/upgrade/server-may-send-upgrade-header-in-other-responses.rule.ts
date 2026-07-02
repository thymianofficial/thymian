import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-send-upgrade-header-in-other-responses',
)
  .severity('hint')
  // Permissive MAY — sending Upgrade in non-101/426 responses is optional advertising, so its presence or absence is never a violation.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY send an Upgrade header field in any other response to advertise that it implements support for upgrading to the listed protocols, in order of descending preference, when appropriate for a future request.',
  )
  .summary('Server MAY send Upgrade header in responses to advertise support.')
  .appliesTo('server', 'origin server')
  .done();
