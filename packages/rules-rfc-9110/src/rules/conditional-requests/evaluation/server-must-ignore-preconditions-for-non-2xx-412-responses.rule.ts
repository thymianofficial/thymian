import { httpRule } from '@thymian/core';

/**
 * This MUST is defined in terms of a counterfactual: the server must ignore
 * preconditions when its response *to the same request without those
 * conditions* would have been something other than 2xx or 412. Conformance
 * therefore cannot be decided from a single observed transaction — a 3xx/4xx/5xx
 * response to a conditional request is exactly the conforming outcome the rule
 * describes (the redirect/error took precedence and the precondition was
 * correctly ignored), not a violation. Deciding a violation would require
 * re-issuing the request without the conditional headers and comparing, which
 * the framework cannot do because the precedence outcome is resource- and
 * state-dependent.
 */
export default httpRule(
  'rfc9110/server-must-ignore-preconditions-for-non-2xx-412-responses',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1')
  .description(
    'A server MUST ignore all received preconditions if its response to the same request without those conditions, prior to processing the request content, would have been a status code other than a 2xx (Successful) or 412 (Precondition Failed). In other words, redirects and failures that can be detected before significant processing occurs take precedence over the evaluation of preconditions.',
  )
  .summary('Server MUST ignore preconditions if response would be non-2xx/412.')
  .appliesTo('server', 'origin server', 'cache')
  .tags('conditional-requests', 'evaluation', 'precedence')
  .done();
