import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-respond-with-404-instead-of-403',
)
  .severity('hint')
  // Permissive MAY: an origin server MAY answer with 404 instead of 403 to
  // hide a resource's existence. Both 403 and 404 are conformant, so there is
  // no non-conformant condition to detect.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden')
  .description(
    'An origin server that wishes to "hide" the current existence of a forbidden target resource MAY instead respond with a status code of 404 (Not Found).',
  )
  .appliesTo('origin server')
  .done();
