import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/implementation-may-remove-bws-before-processing',
)
  .severity('off')
  // Removal of BWS is optional internal recipient behaviour before
  // interpreting/forwarding; there is no required outcome to check and no
  // observable signal in Thymian's traffic.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'Any content known to be defined as BWS MAY be removed before interpreting it or forwarding the message downstream.',
  )
  .summary('BWS content MAY be removed before interpretation or forwarding.')
  .done();
