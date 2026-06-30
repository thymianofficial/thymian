import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-ingore-unrecognized-header-and-trailer-fields-received-in-put-request',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'An origin server SHOULD ignore unrecognized header and trailer fields received in a PUT request (i.e., not save them as part of the resource state).',
  )
  .appliesTo('origin server')
  .done();
