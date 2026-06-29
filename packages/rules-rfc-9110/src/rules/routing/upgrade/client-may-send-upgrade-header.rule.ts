import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-may-send-upgrade-header')
  .severity('hint')
  // Informational (outcome 2): this is a pure permission ("MAY send Upgrade")
  // with no non-conformant condition — neither sending nor omitting the
  // Upgrade header is a violation. The previous implementation flagged every
  // request that did NOT carry Upgrade as a finding, which is incorrect: the
  // absence of an optional header is not a defect. There is nothing to
  // validate, so the rule is reclassified to informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A client MAY send a list of protocol names in the Upgrade header field of a request to invite the server to switch to one or more of the named protocols, in order of descending preference, before sending the final response.',
  )
  .summary('Client MAY send Upgrade header to invite protocol switch.')
  .appliesTo('client', 'user-agent')
  .done();
