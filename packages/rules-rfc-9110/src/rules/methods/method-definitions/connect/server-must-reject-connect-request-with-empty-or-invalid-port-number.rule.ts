import { httpRule } from '@thymian/core';

// Detecting conformance requires sending a CONNECT request with a deliberately
// empty/invalid port in the authority-form request-target and then checking the
// rejection. Thymian generates requests from an OpenAPI description, which does
// not model CONNECT or authority-form targets, so it cannot synthesize the
// malformed request for `test`. A HAR does not preserve the CONNECT
// authority-form target (only normal URLs), so `analyze` cannot identify the
// invalid-port condition either.
export default httpRule(
  'rfc9110/server-must-reject-connect-request-with-empty-or-invalid-port-number',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A server MUST reject a CONNECT request that targets an empty or invalid port number, typically by responding with a 400 (Bad Request) status code.',
  )
  .appliesTo('server')
  .done();
