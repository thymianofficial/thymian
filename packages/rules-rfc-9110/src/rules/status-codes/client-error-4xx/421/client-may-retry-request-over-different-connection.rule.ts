import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-retry-request-over-different-connection',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A client that takes this up sends the same request again after the 421, which a captured trace carries as a second transaction with the same method and target. A captured transaction names no connection, so only the retry is checkable and not that it went over a fresh one or an alternative service; that hint is not written yet.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-421-misdirected-request',
  )
  .description(
    "A client that receives a 421 (Misdirected Request) response MAY retry the request, whether or not the request method is idempotent, over a different connection, such as a fresh connection specific to the target resource's origin, or via an alternative service.",
  )
  .appliesTo('client')
  .done();
