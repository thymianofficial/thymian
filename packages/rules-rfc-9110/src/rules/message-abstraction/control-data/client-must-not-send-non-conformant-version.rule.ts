import { httpRule } from '@thymian/core';

// Informational (outcome 2): a MUST NOT about the HTTP protocol version a
// client sends. The HTTP version token is transport control data not surfaced
// by the rule framework (no version field on HttpRequest; common projection is
// header names / status / media type / body only). Determining "conformance to
// a version" is also internal client state. Not observable.
export default httpRule('rfc9110/client-must-not-send-non-conformant-version')
  .severity('error')
  .type('informational')
  .appliesTo('client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    'A client MUST NOT send a version to which it is not conformant. A client SHOULD send a request version equal to the highest version to which the client is conformant and whose major version is no higher than the highest version supported by the server, if this is known.',
  )
  .summary('Clients MUST NOT send HTTP version they are not conformant to.')
  .done();
