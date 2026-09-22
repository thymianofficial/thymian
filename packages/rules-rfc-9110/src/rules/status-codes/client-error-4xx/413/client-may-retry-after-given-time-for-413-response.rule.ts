import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-retry-after-given-time-for-413-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A client that takes this up sends the request again after the 413, which a captured trace carries as a later transaction against the same target. A captured transaction carries no timestamp, so only the repeat itself is checkable and not whether it waited out the Retry-After value; that hint is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-413-content-too-large')
  .description(
    'If the condition is temporary, the server should generate a Retry-After header field to indicate that it is temporary and after what time the client MAY try again.',
  )
  .appliesTo('client')
  .done();
