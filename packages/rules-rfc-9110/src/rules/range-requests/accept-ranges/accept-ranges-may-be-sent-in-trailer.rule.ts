import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/accept-ranges-may-be-sent-in-trailer')
  .severity('hint')
  // Informational (outcome 2): a permissive "MAY" with a non-binding preference
  // ("preferred to be sent as a header field"). There is no non-conformant
  // condition to detect — sending Accept-Ranges in a trailer is explicitly
  // allowed, and sending it as a header (or not at all) is equally allowed. The
  // previous filter-only rule flagged every transaction that carried
  // Accept-Ranges as a header rather than a trailer, which inverts the guidance
  // and reports the *preferred* behavior as a violation. (Accept-Ranges is also
  // a response field, so the old `requestHeader` match was incorrect.)
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-ranges')
  .description(
    'The Accept-Ranges field MAY be sent in a trailer section, but is preferred to be sent as a header field because the information is particularly useful for restarting large information transfers that have failed in mid-content (before the trailer section is received).',
  )
  .summary(
    'Accept-Ranges may be sent in trailer but header field is preferred for failed transfer recovery.',
  )
  .appliesTo('origin server')
  .done();
