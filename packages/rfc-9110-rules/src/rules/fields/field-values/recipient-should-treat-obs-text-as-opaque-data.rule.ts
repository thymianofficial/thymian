import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for obs-text detection
// Requires detecting obs-text octets (%x80-FF) in field values
//   obs-text = %x80-FF
export default httpRule(
  'rfc9110/recipient-should-treat-obs-text-as-opaque-data',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'A recipient SHOULD treat other allowed octets in field content (i.e., obs-text) as opaque data.',
  )
  .summary('Recipient SHOULD treat obs-text octets as opaque data.')
  .tags('fields', 'field-values')
  .done();
