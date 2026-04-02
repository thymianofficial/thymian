import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/firewall-intermediary-should-replace-internal-hosts-with-pseudonyms',
)
  .severity('warn')
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
