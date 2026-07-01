import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-should-forward-304-response-to-outbound-client',
)
  .severity('warn')
  // Infrastructure-deferred (outcome 3). This SHOULD governs a proxy's
  // forwarding decision: when a 304 is produced for a conditional request that
  // originated with an outbound client, the proxy SHOULD pass the 304 along to
  // that client. Detecting a violation requires observing both the inbound
  // (proxy -> origin) and outbound (client -> proxy) legs of the same exchange
  // and confirming the proxy did NOT forward the 304 - correlation that is not
  // reconstructable from a typical single-vantage HAR. It can, however, be
  // validated from traffic recorded at a proxy that annotates both legs, so the
  // rule stays typed `analytics` scoped to the `proxy` role (no rule function)
  // rather than being downgraded to informational.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified')
  .description(
    'If the conditional request originated with an outbound client, such as a user agent with its own cache sending a conditional GET to a shared proxy, then the proxy SHOULD forward the 304 response to that client.',
  )
  .appliesTo('proxy')
  .done();
