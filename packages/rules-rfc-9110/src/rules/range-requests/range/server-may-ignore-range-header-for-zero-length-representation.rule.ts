import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-may-ignore-range-header-for-zero-length-representation',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A MAY: ignoring the Range header for a zero-length representation is allowed but not required. Ignoring and honoring it are both conformant.',
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
