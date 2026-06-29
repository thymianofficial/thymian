import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/cache-must-not-use-response-without-matching-vary-headers',
)
  .severity('error')
  // Infrastructure-deferred (outcome 3): this MUST NOT governs a cache's reuse
  // decision — it forbids serving a stored response to a later request whose
  // values for the Vary-listed header fields differ from the original request.
  // Detecting a violation requires correlating two requests AND knowing that
  // the second was answered from cache (a cache hit) with the first request's
  // stored representation. That cache-hit linkage is not available from a
  // single transaction and is not reliably reconstructable from a HAR; it
  // depends on the deployed cache. It *could* be validated from traffic
  // recorded at a cache that annotates hits and the selecting header values,
  // so the rule stays typed `analytics` and scoped to the `cache` role rather
  // than being downgraded to informational.
  //
  // The previous implementation flagged any transaction whose request merely
  // carried a common selecting header (Accept-Encoding, Cookie, Authorization,
  // …) as an error. That is not the rule: it does not observe cache reuse or
  // mismatched Vary values, and it fires on virtually all normal traffic. It
  // has been removed in favor of an honest, documented deferral (no rule
  // function) per the outcome-3 contract.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-vary')
  .description(
    'To inform cache recipients that they MUST NOT use this response to satisfy a later request unless the later request has the same values for the listed header fields as the original request (Section 4.1 of [CACHING]) or reuse of the response has been validated by the origin server.',
  )
  .summary(
    'Cache MUST NOT use this response to satisfy a later request unless the later request has the same values for the listed Vary header fields.',
  )
  .appliesTo('cache')
  .done();
