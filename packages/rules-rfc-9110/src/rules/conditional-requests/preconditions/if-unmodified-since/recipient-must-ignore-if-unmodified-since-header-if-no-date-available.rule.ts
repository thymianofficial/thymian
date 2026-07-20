import { httpRule } from '@thymian/core';

/**
 * The trigger condition — "the resource does not have a modification date
 * available" — is internal server state not exposed on the wire, so the
 * framework cannot decide whether ignoring If-Unmodified-Since was required. No
 * observable non-conformant signal exists.
 */
export default httpRule(
  'rfc9110/recipient-must-ignore-if-unmodified-since-header-if-no-date-available',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'A recipient MUST ignore the If-Unmodified-Since header field if the resource does not have a modification date available.',
  )
  .summary(
    'Recipient MUST ignore If-Unmodified-Since when the resource has no modification date available.',
  )
  .appliesTo('server')
  .done();
