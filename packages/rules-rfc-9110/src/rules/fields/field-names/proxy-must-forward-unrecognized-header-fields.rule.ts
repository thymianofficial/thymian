import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-forward-unrecognized-header-fields')
  .severity('error')
  // Outcome 3 (infra-deferred): validatable only from proxy-recorded traffic by
  // correlating a proxy's inbound request hop with the request it forwards
  // (captured per-hop traces) to detect a field name dropped between hops.
  // Not implemented as a fn because the rule is un-decidable from traffic
  // alone: "unrecognized" cannot be distinguished from a field the proxy is
  // "specifically configured to block or transform" (an allowed exception), and
  // Connection-listed / hop-by-hop fields are also legitimately removed. A
  // dropped field is therefore never provably a violation. Typed 'analytics'
  // with appliesTo('proxy') so a deployment with richer proxy-config context
  // can implement it over recorded traffic.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1')
  .description(
    'A proxy MUST forward unrecognized header fields unless the field name is listed in the Connection header field (Section 7.6.1) or the proxy is specifically configured to block, or otherwise transform, such fields.',
  )
  .summary('Proxy MUST forward unrecognized header fields unless excepted.')
  .appliesTo('proxy')
  .done();
