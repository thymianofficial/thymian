import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-must-generate-upgrade-header-field')
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-101-switching-protocols',
  )
  .description(
    "The 101 (Switching Protocols) status code indicates that the server understands and is willing to comply with the client's request, via the Upgrade header field (Section 7.8), for a change in the application protocol being used on this connection. The server MUST generate an Upgrade header field in the response that indicates which protocol(s) will be in effect after this response.",
  )
  .summary(
    'The server MUST generate an Upgrade header field in the response that indicates which protocol(s) will be in effect after this response.',
  )
  .appliesTo('server')
  .done();
