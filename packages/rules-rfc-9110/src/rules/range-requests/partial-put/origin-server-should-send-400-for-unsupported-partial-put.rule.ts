import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-400-for-unsupported-partial-put',
)
  .severity('warn')
  // Informational (outcome 2): the trigger for this SHOULD is "a target resource
  // that does not support partial PUT requests." Whether a resource supports
  // partial PUT is server-internal capability that is not declared in the
  // OpenAPI description nor recoverable from observed traffic, so the
  // precondition cannot be evaluated. A server that DOES support partial PUT
  // and answers a Content-Range PUT with 2xx is perfectly conformant, so any
  // attempt to flag "Content-Range PUT not answered with 400" produces false
  // positives. (The previous static rule was also inverted — it matched PUTs
  // *without* Content-Range and flagged every non-400 response.) With no
  // determinable precondition, this is informational.
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
