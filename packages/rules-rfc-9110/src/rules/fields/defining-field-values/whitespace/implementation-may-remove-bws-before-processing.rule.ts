import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/implementation-may-remove-bws-before-processing',
)
  .severity('off')
  // Informational: a permissive MAY (an implementation may remove BWS before
  // processing/forwarding) with no non-conformant condition — there is nothing
  // to flag. It also concerns the recipient's internal handling of raw
  // whitespace, which is normalized away by the HTTP layer before Thymian sees
  // parsed header values. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'Any content known to be defined as BWS MAY be removed before interpreting it or forwarding the message downstream.',
  )
  .summary('BWS content MAY be removed before interpretation or forwarding.')
  .done();
