import { httpRule } from '@thymian/core';

// A permissive "MAY" about the HTTP protocol version a client sends. The HTTP
// version token lives on the request/status line and is not exposed by the rule
// framework (HttpRequest/HttpResponse carry no version field, and the common
// projection covers only header names, status, media type, and body). There is
// also no observable condition — it is a conditional allowance after a prior
// failed request.
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
