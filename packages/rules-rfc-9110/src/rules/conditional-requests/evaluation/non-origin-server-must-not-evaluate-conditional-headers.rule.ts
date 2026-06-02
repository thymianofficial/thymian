import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/non-origin-server-must-not-evaluate-conditional-headers',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1')
  .description(
    'A server that is not the origin server for the target resource and cannot act as a cache for requests on the target resource MUST NOT evaluate the conditional request header fields defined by this specification, and it MUST forward them if the request is forwarded, since the generating client intends that they be evaluated by a server that can provide a current representation.',
  )
  .summary(
    'Non-origin server that cannot act as cache MUST NOT evaluate conditional headers.',
  )
  .appliesTo('intermediary', 'proxy')
  .tags('conditional-requests', 'evaluation', 'forwarding')
  // No automated rule is registered. This is an infrastructure (intermediary/proxy)
  // rule: reliably distinguishing an intermediary from an origin server, and knowing
  // what the origin's counterfactual response would have been, is not observable in
  // generic recorded traffic. Per the infrastructure exception in issue #327's
  // Acceptance Criteria, the rule remains analytics-classified because it COULD be
  // validated in specific proxy deployments where the intermediary's identity and the
  // origin's response are both captured.
  .done();
