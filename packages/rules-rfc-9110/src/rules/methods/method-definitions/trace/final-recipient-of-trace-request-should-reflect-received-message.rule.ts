import { httpRule } from '@thymian/core';

// Verifying that the 200 response "reflects the message received" requires
// reconstructing the exact request as the final recipient saw it (after
// intermediaries) and matching it field-by-field against the response body,
// while excluding the fields the spec says to omit. That whole-message
// reflection comparison is not expressible with the available rule APIs (the
// common projection exposes header names only, and a faithful reflection check
// needs the full received message), so it is not implemented as a brittle,
// false-positive-prone approximation. (The related security concern — not
// echoing sensitive data — IS implemented separately in
// final-recipient-should-exclude-sensitive-request-data-from-response-to-trace.)
export default httpRule(
  'rfc9110/final-recipient-of-trace-request-should-reflect-received-message',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description(
    'The final recipient of the request SHOULD reflect the message received, excluding some fields described below, back to the client as the content of a 200 (OK) response.',
  )
  .appliesTo('server')
  .done();
