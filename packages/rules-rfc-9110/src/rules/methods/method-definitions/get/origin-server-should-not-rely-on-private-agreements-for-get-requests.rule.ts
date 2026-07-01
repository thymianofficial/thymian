import { httpRule } from '@thymian/core';

// Informational: "relying on a private (out-of-band) agreement" to receive GET
// content is a property of the server's design intent, not of any observable
// HTTP message. Nothing in a request, response, or recorded trace reveals
// whether the server depends on such an agreement, so the SHOULD NOT cannot be
// checked. The rule ships no function.
export default httpRule(
  'rfc9110/origin-server-should-not-rely-on-private-agreements',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-get')
  .description(
    'An origin server SHOULD NOT rely on private agreements to receive content, since participants in HTTP communication are often unaware of intermediaries along the request chain.',
  )
  .appliesTo('origin server')
  .done();
