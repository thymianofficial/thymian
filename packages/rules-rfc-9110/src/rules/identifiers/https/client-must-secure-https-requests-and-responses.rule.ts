import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-secure-https-requests-and-responses',
)
  .severity('error')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    "A client MUST ensure that its HTTP requests for an 'https' resource are secured, prior to being communicated, and that it only accepts secured responses to those requests.\n\nContext: This requirement applies whenever a client is sending requests to, or receiving responses from, an 'https' URI. The client must not send unencrypted requests or accept unencrypted responses for 'https' resources.",
  )
  .appliesTo('client')
  .done();
