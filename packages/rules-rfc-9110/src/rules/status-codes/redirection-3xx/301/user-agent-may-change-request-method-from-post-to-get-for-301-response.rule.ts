import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-change-request-method-from-post-to-get-for-301-response',
)
  .severity('hint')
  // Permissive MAY describing an internal user-agent decision (whether to
  // change POST to GET when following a 301). Both behaviors are conformant,
  // so there is no non-conformant condition. The previous classification
  // declared `static` with a rule that merely flagged every POST that received
  // a 301 - which is not a violation. Reclassified to informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-301-moved-permanently')
  .summary(
    'For historical reasons, a user agent MAY change the request method from POST to GET for the subsequent request.',
  )
  .description(
    'For historical reasons, a user agent MAY change the request method from POST to GET for the subsequent request. If this behavior is undesired, the 308 (Permanent Redirect) status code can be used instead.',
  )
  .appliesTo('user-agent')
  .done();
