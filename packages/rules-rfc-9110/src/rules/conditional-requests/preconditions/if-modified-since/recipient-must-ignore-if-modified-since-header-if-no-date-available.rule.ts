import { httpRule } from '@thymian/core';

/**
 * The condition "the resource does not have a modification date available" is
 * internal server state that is not exposed on the wire — the framework cannot
 * know whether a given resource has a modification date, so it cannot decide
 * whether ignoring If-Modified-Since was required. No observable non-conformant
 * signal exists.
 */
export default httpRule(
  'rfc9110/recipient-must-ignore-if-modified-since-header-if-no-date-available',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'A recipient MUST ignore the If-Modified-Since header field if the resource does not have a modification date available.',
  )
  .summary(
    'Recipient MUST ignore If-Modified-Since when the resource has no modification date available.',
  )
  .appliesTo('server', 'origin server', 'cache')
  .tags('conditional-requests', 'if-modified-since', 'evaluation')
  .done();
