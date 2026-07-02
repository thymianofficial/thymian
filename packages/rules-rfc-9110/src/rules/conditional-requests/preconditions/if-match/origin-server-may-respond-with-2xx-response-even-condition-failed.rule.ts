import { httpRule } from '@thymian/core';

/**
 * This is a permissive MAY: when an If-Match condition fails on a state-changing
 * request that appears to have already been applied, the origin server *may*
 * answer 2xx instead of 412. Both 2xx and 412 are conformant, so there is no
 * non-conformant outcome to detect. A 2xx for an already-applied change is
 * indistinguishable from a normal success without knowing the resource's prior
 * state, which the framework does not have. The hard MUST NOT (do not perform
 * the method when the condition is false) is enforced by
 * `origin-server-must-not-perform-method-when-if-match-fails`.
 */
export default httpRule(
  'rfc9110/origin-server-may-respond-with-2xx-response-even-condition-failed',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An origin server that evaluates an If-Match condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code. Alternatively, if the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code (i.e., the change requested by the user agent has already succeeded, but the user agent might not be aware of it, perhaps because the prior response was lost or an equivalent change was made by some other user agent).',
  )
  .summary(
    'If the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-match', '412', 'precondition-failed')
  .done();
