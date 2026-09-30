import { httpRule } from '@thymian/core';

// A NOTE the counting rule counts because it quotes a keyword to explain
// one: a unit, but nothing any message could conform to or violate.
export default httpRule(
  'rfc-6797/sts-header-inclusion-is-should-to-accommodate-caches',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A note explaining why the requirement before it is a SHOULD rather than a MUST; it states no requirement a message could meet or break. Sending the header is checked by server-may-establish-hsts-over-secure-transport and, in the recommended profile, by the server-should-send-sts-header-over-secure-transport convention rule.',
  )
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.1')
  .description(
    'NOTE: Including the STS header field is stipulated as a "SHOULD" in order to accommodate various server- and network-side caches and load-balancing configurations where it may be difficult to uniformly emit STS header fields on behalf of a given HSTS Host.',
  )
  .summary(
    'Sending Strict-Transport-Security is a SHOULD to accommodate caches and load balancers.',
  )
  .explanation(
    'RFC 6797 asks for the header on every response over https without requiring it, because a cache or load balancer in front of the host may answer with responses the host itself never emitted. That is also why a missing header is worth reporting: the layer that drops it is usually one the operator configured and forgot.',
  )
  .appliesTo('server')
  .done();
