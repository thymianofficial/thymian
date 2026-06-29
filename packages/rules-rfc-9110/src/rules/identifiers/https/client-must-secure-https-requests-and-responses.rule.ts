import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-secure-https-requests-and-responses',
)
  .severity('error')
  // Reclassified static -> informational (outcome 4 then outcome 2). The rule
  // previously declared an active `static` (lint) context but shipped no rule
  // function, so it counted as "covered" while doing nothing. It cannot be
  // honestly implemented in any context: it requires the client to actually
  // secure (encrypt) the requests/responses for an `https` resource on the wire.
  // The OpenAPI description does not declare transport encryption, and recorded
  // traffic (HAR) captures decrypted application-layer messages without the
  // wire's TLS state — so neither lint, test, nor analyze can observe whether
  // the client secured the connection. It is an internal client/transport
  // behavior, hence informational. Security-relevant (see PR security section).
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    "A client MUST ensure that its HTTP requests for an 'https' resource are secured, prior to being communicated, and that it only accepts secured responses to those requests.\n\nContext: This requirement applies whenever a client is sending requests to, or receiving responses from, an 'https' URI. The client must not send unencrypted requests or accept unencrypted responses for 'https' resources.",
  )
  .appliesTo('client')
  .done();
