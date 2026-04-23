import { httpRule } from '@thymian/core';

// TODO: Implement ABNF validation for invalid character detection
// Requires detecting CR (%x0D), LF (%x0A), or NUL (%x00) in field values
// Can be implemented in analytics context to validate message handling
export default httpRule(
  'rfc9110/recipient-must-reject-or-replace-invalid-characters',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'Field values containing CR, LF, or NUL characters are invalid and dangerous, due to the varying ways that implementations might parse and interpret those characters; a recipient of CR, LF, or NUL within a field value MUST either reject the message or replace each of those characters with SP before further processing or forwarding of that message.',
  )
  .summary(
    'Recipient MUST either reject messages or replace CR, LF, or NUL characters with SP in field values.',
  )
  .tags('fields', 'field-values', 'security')
  .done();
