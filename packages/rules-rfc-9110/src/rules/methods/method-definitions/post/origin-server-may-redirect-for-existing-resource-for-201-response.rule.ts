import { httpRule } from '@thymian/core';

// This is a conditional MAY. The condition — "the result of processing the POST
// would be equivalent to a representation of an existing resource" — is
// server-internal and not observable from any message; and even when it holds,
// redirecting via 303 is merely permitted, not required. There is nothing
// observable to flag.
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
