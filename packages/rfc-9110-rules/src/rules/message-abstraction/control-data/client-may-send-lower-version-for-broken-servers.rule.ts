import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-may-send-lower-version-for-broken-servers',
)
  .severity('hint')
  .type('informational')
  .appliesTo('client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    'A client MAY send a lower request version if it is known that the server incorrectly implements the HTTP specification, but only after the client has attempted at least one normal request and determined from the response status code or header fields (e.g., Server) that the server improperly handles higher request versions.',
  )
  .summary(
    'Clients MAY send lower HTTP version for servers that improperly handle higher versions.',
  )
  .done();
