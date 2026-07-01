import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-modify-authorization')
  .severity('error')
  // Infrastructure-deferred (outcome 3): this MUST NOT governs a *proxy hop* —
  // a proxy forwarding a request must not alter its Authorization header field.
  // Detecting a violation requires correlating the request a proxy received
  // with the request it forwarded and observing the field value changed. That
  // two-sided, per-hop linkage is not available from a single transaction and
  // is not reliably reconstructable from a typical HAR; it depends on traffic
  // captured at the proxy itself. Because it *is* validatable from
  // proxy-recorded traffic, the rule stays typed `analytics` and scoped to the
  // `proxy` role, without a rule function, per the outcome-3 contract.
  .type('analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A proxy forwarding a request MUST NOT modify any Authorization header fields in that request.',
  )
  .appliesTo('proxy')
  .done();
