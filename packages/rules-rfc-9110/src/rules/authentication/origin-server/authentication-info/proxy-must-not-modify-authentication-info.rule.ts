import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-modify-authentication-info')
  .severity('error')
  // Infrastructure-deferred (outcome 3): this MUST NOT governs a *proxy hop* —
  // a proxy must forward the Authentication-Info response field byte-for-byte.
  // Detecting a violation requires correlating the message a proxy received
  // with the message it forwarded (the inbound and outbound sides of the same
  // hop) and observing that the field value changed. That two-sided, per-hop
  // linkage is not available from a single transaction and is not reliably
  // reconstructable from a typical HAR; it depends on traffic captured at the
  // proxy itself. Because it *is* validatable from proxy-recorded traffic, the
  // rule stays typed `analytics` and scoped to the `proxy` role rather than
  // being downgraded to informational. Previously mis-typed `informational`;
  // reclassified to `analytics` to match its sibling MUST-NOT-modify rules.
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A proxy forwarding a response is not allowed to modify the Authentication-Info field value in any way.',
  )
  .appliesTo('proxy')
  .done();
