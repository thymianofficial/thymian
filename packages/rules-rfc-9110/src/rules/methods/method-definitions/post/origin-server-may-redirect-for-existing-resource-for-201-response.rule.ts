import { httpRule } from '@thymian/core';

// Informational (reclassified from static/analytics/test): this is a
// conditional MAY. The condition — "the result of processing the POST would be
// equivalent to a representation of an existing resource" — is server-internal
// and not observable from any message; and even when it holds, redirecting via
// 303 is merely permitted, not required. The previous `overrideTest`
// implementation replayed a 201-producing POST and flagged any response that
// was not 303 as a violation, which is wrong on both counts (it would penalize
// the perfectly conformant 201 the spec expects in the common case). There is
// nothing observable to flag, so the rule ships no function.
export default httpRule(
  'rfc9110/origin-server-may-redirect-for-existing-resource-for-201-response',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-post')
  .description(
    "If the result of processing a POST would be equivalent to a representation of an existing resource, an origin server MAY redirect the user agent to that resource by sending a 303 (See Other) response with the existing resource's identifier in the Location field.",
  )
  .appliesTo('origin server')
  .done();
