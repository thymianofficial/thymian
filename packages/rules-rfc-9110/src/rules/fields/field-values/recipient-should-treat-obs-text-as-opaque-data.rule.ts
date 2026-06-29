import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-treat-obs-text-as-opaque-data',
)
  .severity('warn')
  // Informational: this SHOULD describes how the recipient internally treats
  // obs-text octets (as opaque data). It is an internal handling decision with
  // no observable effect in the messages Thymian can lint, test, or analyze —
  // a conformant and a non-conformant recipient are indistinguishable from the
  // outside. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'A recipient SHOULD treat other allowed octets in field content (i.e., obs-text) as opaque data.',
  )
  .summary('Recipient SHOULD treat obs-text octets as opaque data.')
  .done();
