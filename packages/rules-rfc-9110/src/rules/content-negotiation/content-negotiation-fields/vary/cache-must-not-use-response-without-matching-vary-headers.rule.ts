import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/cache-must-not-use-response-without-matching-vary-headers',
)
  .severity('error')
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
