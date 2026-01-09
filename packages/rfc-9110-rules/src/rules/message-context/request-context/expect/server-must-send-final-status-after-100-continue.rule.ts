import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-send-final-status-after-100-continue',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that sends a 100 (Continue) response MUST ultimately send a final status code, once it receives and processes the request content, unless the connection is closed prematurely.',
  )
  .appliesTo('server')
  .done();
