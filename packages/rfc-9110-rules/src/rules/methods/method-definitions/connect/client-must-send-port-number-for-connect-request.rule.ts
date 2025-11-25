import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-must-send-port-number-for-connect-request',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A client MUST send the port number even if the CONNECT request is based on a URI reference that contains an authority component with an elided port.',
  )
  .appliesTo('client')
  .done();
