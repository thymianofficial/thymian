import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-not-modify-absolute-path-and-query')
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-message-transformations',
  )
  .description(
    'A proxy MUST NOT modify the "absolute-path" and "query" parts of the received target URI when forwarding it to the next inbound server except as required by that forwarding protocol. For example, a proxy forwarding a request to an origin server via HTTP/1.1 will replace an empty path with "/" or "*", depending on the request method.',
  )
  .summary('Proxy MUST NOT modify absolute-path and query parts of target URI.')
  .appliesTo('proxy')
  .done();
