import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-may-send-upgrade-header')
  .severity('hint')
  // Permissive MAY — a client sending Upgrade is optional, so its presence or absence is never a violation.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A client MAY send a list of protocol names in the Upgrade header field of a request to invite the server to switch to one or more of the named protocols, in order of descending preference, before sending the final response.',
  )
  .summary('Client MAY send Upgrade header to invite protocol switch.')
  .appliesTo('client', 'user-agent')
  .done();
