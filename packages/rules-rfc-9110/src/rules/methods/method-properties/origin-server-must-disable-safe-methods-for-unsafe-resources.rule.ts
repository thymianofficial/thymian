import { httpRule } from '@thymian/core';

// Informational (security-relevant): this MUST guards against safe methods
// (e.g. GET) triggering unsafe side effects such as "page?do=delete". Whether
// a resource's *purpose* is to perform an unsafe action, and whether a safe
// method actually mutated state, is server-internal semantics: the URI and
// method alone cannot tell an action-bearing safe request from a benign one,
// and a successful response does not reveal a side effect. The conformant
// condition is therefore unobservable, so the rule ships no function (rather
// than a query-parameter heuristic that would produce rampant false
// positives). The risk is real, so this is documented here for reviewers even
// though it cannot be mechanically validated.
export default httpRule(
  'rfc9110/origin-server-must-disable-safe-methods-for-unsafe-resources',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods')
  .summary(
    'If the purpose of such a resource is to perform an unsafe action, then the resource owner MUST disable or disallow that action when it is accessed using a safe request method.',
  )
  .description(
    'When a resource is constructed such that parameters within the target URI have the effect of selecting an action, it is the resource owner\'s responsibility to ensure that the action is consistent with the request method semantics. For example, it is common for Web-based content editing software to use actions within query parameters, such as "page?do=delete". If the purpose of such a resource is to perform an unsafe action, then the resource owner MUST disable or disallow that action when it is accessed using a safe request method.',
  )
  .appliesTo('origin server')
  .done();
