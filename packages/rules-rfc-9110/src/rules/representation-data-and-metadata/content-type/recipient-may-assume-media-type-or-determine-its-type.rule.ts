import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-assume-media-type-or-determine-its-type',
)
  .severity('warn')
  // Pure recipient latitude (MAY assume octet-stream or sniff). Nothing
  // observable on the wire distinguishes a conforming choice from a
  // non-conforming one.
  .type('informational')
  .appliesTo('client', 'user-agent')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3')
  .description(
    `If a Content-Type header field is not present, the recipient MAY either assume a media type of "application/octet-stream" ([RFC2046], Section 4.5.1) or examine the data to determine its type.`,
  )
  .summary(
    'When Content-Type is absent, a recipient MAY assume application/octet-stream or sniff the body.',
  )
  .done();
