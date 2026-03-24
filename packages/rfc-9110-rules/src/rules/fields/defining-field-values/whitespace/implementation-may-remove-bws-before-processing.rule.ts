import { httpRule } from '@thymian/core';

// TODO: Implement ABNF validation for BWS detection
// Requires identifying BWS positions in grammar for optional removal
export default httpRule(
  'rfc9110/implementation-may-remove-bws-before-processing',
)
  .severity('off')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'Any content known to be defined as BWS MAY be removed before interpreting it or forwarding the message downstream.',
  )
  .summary('BWS content MAY be removed before interpretation or forwarding.')
  .tags('fields', 'whitespace')
  .done();
