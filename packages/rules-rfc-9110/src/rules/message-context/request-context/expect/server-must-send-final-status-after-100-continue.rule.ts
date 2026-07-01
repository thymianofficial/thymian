import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-send-final-status-after-100-continue',
)
  .severity('hint')
  // Informational: verifying a final status "ultimately" follows a 100
  // (Continue) requires correlating the interim and final responses on the same
  // request over time, which is not available; surfaced as guidance only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that sends a 100 (Continue) response MUST ultimately send a final status code, once it receives and processes the request content, unless the connection is closed prematurely.',
  )
  .appliesTo('server')
  .done();
