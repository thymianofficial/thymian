import { httpRule } from '@thymian/core';

/**
 * Informational (outcome 2). Sending both If-Match and If-Unmodified-Since is
 * explicitly allowed (combined for interoperability with older intermediaries);
 * the rule only requires that the recipient *ignore* If-Unmodified-Since when
 * If-Match is present. Whether it was ignored is internal — the precondition
 * outcome is driven by If-Match in either case, so no observable signal
 * distinguishes conforming from non-conforming behavior. The previous
 * implementation flagged every request carrying both headers as a violation,
 * mis-flagging entirely conformant requests. Reclassified to informational.
 */
export default httpRule(
  'rfc9110/recipient-must-ignore-if-unmodified-since-when-if-match-present',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'A recipient MUST ignore If-Unmodified-Since if the request contains an If-Match header field; the condition in If-Match is considered to be a more accurate replacement for the condition in If-Unmodified-Since, and the two are only combined for the sake of interoperating with older intermediaries that might not implement If-Match.',
  )
  .summary(
    'Recipient MUST ignore If-Unmodified-Since when If-Match is present.',
  )
  .appliesTo('server', 'origin server', 'cache')
  .tags('conditional-requests', 'if-unmodified-since', 'if-match')
  .done();
