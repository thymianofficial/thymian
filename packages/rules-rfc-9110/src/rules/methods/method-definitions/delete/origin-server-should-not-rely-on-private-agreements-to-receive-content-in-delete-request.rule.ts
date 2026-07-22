import { httpRule } from '@thymian/core';

// "Relying on a private (out-of-band) agreement" is a property of the server's
// design intent, not of any observable HTTP message. Nothing in a request,
// response, or recorded trace reveals whether the server is depending on such
// an agreement to accept DELETE content, so the SHOULD NOT cannot be checked.
export default httpRule(
  'rfc9110/origin-server-should-not-rely-on-private-agreements-to-receive-content-in-delete-request',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-delete')
  .description(
    'An origin server SHOULD NOT rely on private agreements to receive content, since participants in HTTP communication are often unaware of intermediaries along the request chain.',
  )
  .appliesTo('origin server')
  .done();
