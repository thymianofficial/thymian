import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-may-retry-request-over-different-connection',
)
  .severity('hint')
  // Permissive MAY describing an internal client retry decision over a
  // different connection; no non-conformant condition to observe.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-421-misdirected-request',
  )
  .description(
    "A client that receives a 421 (Misdirected Request) response MAY retry the request, whether or not the request method is idempotent, over a different connection, such as a fresh connection specific to the target resource's origin, or via an alternative service.",
  )
  .appliesTo('client')
  .done();
