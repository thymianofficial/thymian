import { httpRule } from '@thymian/core';

// Informational (reclassified from static/analytics): the SHOULD is gated on a
// server-internal condition ("when a PUT representation is inconsistent with
// the target resource") that no message exposes, and even then 409/415 are
// only *suggested* — the server may instead make the representation consistent
// and succeed. The previous implementation flagged every PUT whose status was
// not 409/415 as a violation, which fires on all successful PUTs and is
// clearly wrong. With neither the triggering condition nor a definite required
// status observable, the rule ships no function.
export default httpRule(
  'rfc9110/origin-server-should-response-with-409-or-415-status-code-to-put-request-for-inconsistent-representation',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'When a PUT representation is inconsistent with the target resource, the origin server SHOULD either make them consistent, by transforming the representation or changing the resource configuration, or respond with an appropriate error message containing sufficient information to explain why the representation is unsuitable. The 409 (Conflict) or 415 (Unsupported Media Type) status codes are suggested, with the latter being specific to constraints on Content-Type values.',
  )
  .appliesTo('origin server')
  .done();
