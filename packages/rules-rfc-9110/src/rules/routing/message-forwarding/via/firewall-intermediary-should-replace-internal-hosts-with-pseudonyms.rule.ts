import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/firewall-intermediary-should-replace-internal-hosts-with-pseudonyms',
)
  .severity('warn')
  // Same topology dependency: detecting that an internal host should have been
  // (but was not) replaced by a pseudonym requires knowing which hosts are
  // internal, which is deployment-specific and absent from the message. Not
  // decidable from captured traffic.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'If not explicitly enabled to forward internal host names, an intermediary used as a portal through a network firewall SHOULD replace each received-by host of any host behind the firewall by an appropriate pseudonym for that host. This protects internal network information.',
  )
  .summary(
    'Firewall intermediary SHOULD replace internal hosts with pseudonyms.',
  )
  .appliesTo('intermediary')
  .done();
