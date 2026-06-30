import { httpRule } from '@thymian/core';

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
  .done();
