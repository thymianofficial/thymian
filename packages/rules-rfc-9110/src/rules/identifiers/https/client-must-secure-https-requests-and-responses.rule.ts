import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-secure-https-requests-and-responses',
)
  .severity('error')
  // Informational (#327): unobservable. Whether a client secured its transport
  // (TLS) and refused unencrypted responses is a connection-layer property; it
  // is not visible in the recorded HTTP message content Thymian analyzes.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    "A client MUST ensure that its HTTP requests for an 'https' resource are secured, prior to being communicated, and that it only accepts secured responses to those requests.\n\nContext: This requirement applies whenever a client is sending requests to, or receiving responses from, an 'https' URI. The client must not send unencrypted requests or accept unencrypted responses for 'https' resources.",
  )
  .appliesTo('client')
  .done();
