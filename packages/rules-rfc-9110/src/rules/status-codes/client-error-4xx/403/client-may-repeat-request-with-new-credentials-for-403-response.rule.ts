import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-may-repeat-request-with-new-credentials-for-403-response',
)
  .severity('hint')
  // Permissive MAY describing an internal client retry decision; no
  // non-conformant condition exists to detect. The previous classification
  // declared `analytics` but shipped no rule function. Reclassified to
  // informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden')
  .description(
    'The client MAY repeat the request with new or different credentials.',
  )
  .appliesTo('client')
  .done();
