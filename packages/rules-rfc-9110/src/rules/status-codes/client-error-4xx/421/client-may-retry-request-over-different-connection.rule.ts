import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-retry-request-over-different-connection',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A MAY describing an internal client retry decision over a different connection; no non-conformant condition to observe.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-421-misdirected-request',
  )
  .description(
    "A client that receives a 421 (Misdirected Request) response MAY retry the request, whether or not the request method is idempotent, over a different connection, such as a fresh connection specific to the target resource's origin, or via an alternative service.",
  )
  .appliesTo('client')
  .done();
