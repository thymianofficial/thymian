import { httpRule } from '@thymian/core';

// Informational: detecting this MUST NOT requires comparing the request a proxy
// *received* (without Max-Forwards) against the request it *forwarded* (with a
// newly added Max-Forwards) — i.e. correlating two hops of the same request
// chain. A single captured transaction does not carry both hops, and a typical
// HAR records only the user-agent↔server view, not the proxy's inbound and
// outbound messages, so the added-header condition cannot be reconstructed.
// The behavior is therefore not observable in our model; the rule ships no
// function.
export default httpRule(
  'rfc9110/proxy-must-not-generate-new-max-forwards-header',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A proxy MUST NOT generate a Max-Forwards header field while forwarding a request unless that request was received with a Max-Forwards field.',
  )
  .appliesTo('proxy')
  .done();
