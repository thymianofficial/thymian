import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for VCHAR character detection
// Requires validating field values only contain VCHAR (%x21-7E), SP (%x20), and HTAB (%x09)
// Can be implemented in static context to validate outgoing field values
export default httpRule(
  'rfc9110/new-fields-should-limit-values-to-visible-ascii',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'Specifications for newly defined fields SHOULD limit their values to visible US-ASCII octets (VCHAR), SP, and HTAB.',
  )
  .summary(
    'Specifications for new fields SHOULD limit values to visible ASCII, SP, and HTAB.',
  )
  .tags('fields', 'field-values', 'specification')
  .done();
