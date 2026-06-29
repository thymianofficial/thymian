import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-should-not-use-from-for-authentication')
  .severity('hint')
  // Informational (#327): a SHOULD NOT governing the server's *internal* use of
  // the From header for access control / authentication. Whether a server uses
  // a header for an authorization decision is not observable from the
  // request/response messages. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-from')
  .description(
    'A server SHOULD NOT use the From header field for access control or authentication, since its value is expected to be visible to anyone receiving or observing the request and is often recorded within logfiles and error reports without any expectation of privacy.',
  )
  .appliesTo('server')
  .done();
