import { httpRule } from '@thymian/core';

// TODO: Implement ABNF validation for OWS/RWS normalization
// Requires detecting OWS/RWS positions and optionally normalizing to single SP
export default httpRule(
  'rfc9110/implementation-may-replace-ows-or-rws-with-single-sp',
)
  .severity('off')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'Any content known to be defined as OWS or RWS MAY be replaced with a single SP before interpreting it or forwarding the message downstream.',
  )
  .summary(
    'OWS or RWS content MAY be replaced with a single SP before interpretation or forwarding.',
  )
  .tags('fields', 'whitespace')
  .done();
