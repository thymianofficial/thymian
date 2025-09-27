import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-must-ignore-content-length-or-transfer-encoding-headers-in-response-to-connect',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A client MUST ignore any Content-Length or Transfer-Encoding header fields received in a successful response to CONNECT.',
  )
  .appliesTo('client')
  .done();
