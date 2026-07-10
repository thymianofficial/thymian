import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/cache-must-not-use-response-without-matching-vary-headers',
)
  .severity('error')
  // Governs a cache's reuse decision: serving a stored response to a later
  // request whose values for the Vary-listed header fields differ from the
  // original request. Detecting a violation requires correlating two requests
  // and knowing that the second was answered from cache with the first's
  // stored representation. That cache-hit linkage is not available from a
  // single transaction and is not reliably reconstructable from a HAR; it
  // would take traffic recorded at a cache that annotates hits and the
  // selecting header values.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-vary')
  .description(
    'To inform cache recipients that they MUST NOT use this response to satisfy a later request unless the later request has the same values for the listed header fields as the original request (Section 4.1 of [CACHING]) or reuse of the response has been validated by the origin server.',
  )
  .summary(
    'Cache MUST NOT use this response to satisfy a later request unless the later request has the same values for the listed Vary header fields.',
  )
  .appliesTo('cache')
  .done();
