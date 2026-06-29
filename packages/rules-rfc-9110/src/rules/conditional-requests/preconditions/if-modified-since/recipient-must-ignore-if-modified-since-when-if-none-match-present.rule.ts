import { httpRule } from '@thymian/core';

/**
 * Informational (outcome 2). Sending both If-None-Match and If-Modified-Since
 * is explicitly allowed by the spec (the two are combined for interoperability
 * with older intermediaries); the rule only requires that the recipient
 * *ignore* If-Modified-Since when If-None-Match is present. Whether the
 * recipient ignored it is internal — the status is driven by If-None-Match in
 * either case, so no observable signal distinguishes conforming from
 * non-conforming behavior. The previous implementation flagged every request
 * carrying both headers as a violation, which mis-flags entirely conformant
 * requests. Reclassified to informational.
 */
export default httpRule(
  'rfc9110/recipient-must-ignore-if-modified-since-when-if-none-match-present',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'A recipient MUST ignore If-Modified-Since if the request contains an If-None-Match header field; the condition in If-None-Match is considered to be a more accurate replacement for the condition in If-Modified-Since, and the two are only combined for the sake of interoperating with older intermediaries that might not implement If-None-Match.',
  )
  .summary(
    'Recipient MUST ignore If-Modified-Since when If-None-Match is present.',
  )
  .appliesTo('server', 'origin server', 'cache')
  .tags('conditional-requests', 'if-modified-since', 'if-none-match')
  .done();
