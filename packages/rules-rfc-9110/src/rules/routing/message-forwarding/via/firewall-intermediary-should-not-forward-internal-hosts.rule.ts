import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/firewall-intermediary-should-not-forward-internal-hosts',
)
  .severity('warn')
  // Whether a forwarded received-by host lies "within the firewall region"
  // depends on the deployment's internal topology, which is not encoded in the
  // message. An observer cannot distinguish an internal host from an external
  // one from the Via value alone, so conformance is not decidable from captured
  // traffic.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'An intermediary used as a portal through a network firewall SHOULD NOT forward the names and ports of hosts within the firewall region unless it is explicitly enabled to do so. This protects internal network topology from exposure.',
  )
  .summary('Firewall intermediary SHOULD NOT forward internal host names.')
  .appliesTo('intermediary')
  .done();
