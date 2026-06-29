import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-assume-media-type-or-determine-its-type',
)
  .severity('warn')
  // Informational (outcome 2): this is a permissive MAY describing what a
  // RECIPIENT is allowed to do when Content-Type is absent (assume
  // application/octet-stream, or sniff the body). Both choices are conformant
  // and the decision is internal recipient behavior, so there is no
  // non-conformant condition to detect.
  //
  // The previous implementation reported a violation whenever a message had a
  // body but no Content-Type. That is not this rule at all — it is the
  // (separate) sender-side SHOULD `sender-should-generate-content-type-for-
  // message-with-content`, already covered by its own rule. Detecting a missing
  // Content-Type here merely duplicated that rule and mischaracterized a
  // recipient permission as a sender obligation. Reclassified to informational
  // with no rule function.
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
