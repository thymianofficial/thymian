import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-ignore-range-header-for-zero-length-representation',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    "A server that supports range requests MAY ignore a Range header field when the selected representation has no content (i.e., the selected representation's data is of zero length).",
  )
  .summary(
    'A server may ignore a Range header field when the selected representation has zero-length content.',
  )
  .appliesTo('server')
  .done();
