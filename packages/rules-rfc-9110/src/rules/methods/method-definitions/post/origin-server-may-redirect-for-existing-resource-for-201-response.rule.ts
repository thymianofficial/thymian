import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-redirect-for-existing-resource-for-201-response',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-post')
  .description(
    "If the result of processing a POST would be equivalent to a representation of an existing resource, an origin server MAY redirect the user agent to that resource by sending a 303 (See Other) response with the existing resource's identifier in the Location field.",
  )
  .appliesTo('origin server')
  .done();
