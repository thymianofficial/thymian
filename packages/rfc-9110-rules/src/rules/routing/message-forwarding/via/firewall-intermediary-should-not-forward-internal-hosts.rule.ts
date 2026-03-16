import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/firewall-intermediary-should-not-forward-internal-hosts',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'An intermediary used as a portal through a network firewall SHOULD NOT forward the names and ports of hosts within the firewall region unless it is explicitly enabled to do so. This protects internal network topology from exposure.',
  )
  .summary('Firewall intermediary SHOULD NOT forward internal host names.')
  .appliesTo('intermediary')
  .done();
