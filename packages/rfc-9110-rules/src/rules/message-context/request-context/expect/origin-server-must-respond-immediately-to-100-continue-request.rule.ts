import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-must-respond-immediately-to-100-continue-request',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'Upon receiving an HTTP/1.1 (or later) request that has a method, target URI, and complete header section that contains a 100-continue expectation and an indication that request content will follow, an origin server MUST send either an immediate response with a final status code, or an immediate 100 (Continue) response.',
  )
  .appliesTo('origin server')
  .done();
