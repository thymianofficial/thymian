import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-may-ignore-range-header-for-zero-length-representation',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A server that takes this up answers a Range request against an empty representation with 200 and no content; declining shows instead as 416 carrying `Content-Range: bytes */0`, so the zero length is on the wire either way. The `hint` — a range request against an empty representation was rejected rather than ignored — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    "A server that supports range requests MAY ignore a Range header field when the selected representation has no content (i.e., the selected representation's data is of zero length).",
  )
  .summary(
    'A server may ignore a Range header field when the selected representation has zero-length content.',
  )
  .appliesTo('server')
  .done();
