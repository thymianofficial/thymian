import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-send-final-status-after-100-continue',
)
  .severity('hint')
  // Informational (#327): a MUST about eventual delivery of a final status after
  // a 100 Continue, with an explicit exception for prematurely closed
  // connections. Distinguishing a missing final status from a legitimate
  // premature close requires connection-lifecycle observation that a captured
  // request/response transaction does not provide. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that sends a 100 (Continue) response MUST ultimately send a final status code, once it receives and processes the request content, unless the connection is closed prematurely.',
  )
  .appliesTo('server')
  .done();
