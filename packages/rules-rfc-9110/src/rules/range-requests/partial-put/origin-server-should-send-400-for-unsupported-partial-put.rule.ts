import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-400-for-unsupported-partial-put',
)
  .severity('warn')
  // Informational (outcome 2): the trigger is "a target resource that does not
  // support partial PUT." Whether a resource supports partial PUT is server-
  // internal capability, not declared in the spec nor recoverable from traffic,
  // so the precondition cannot be evaluated and any flag produces false positives.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-partial-put')
  .description(
    'An origin server SHOULD respond with a 400 (Bad Request) status code if it receives Content-Range on a PUT for a target resource that does not support partial PUT requests.',
  )
  .summary(
    'Origin server should respond with 400 to a Content-Range PUT on a resource that does not support partial PUT.',
  )
  .appliesTo('origin server')
  .done();
