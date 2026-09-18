import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-send-lower-version-for-broken-servers',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#142',
    'A client that takes this up sends a normal request first, then repeats it with a lower version token once the response status or Server field shows the server mishandles the higher one — two transactions a captured trace already carries. The request protocol version is not exposed to rules, so the drop itself cannot be seen.',
  )
  .appliesTo('client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    'A client MAY send a lower request version if it is known that the server incorrectly implements the HTTP specification, but only after the client has attempted at least one normal request and determined from the response status code or header fields (e.g., Server) that the server improperly handles higher request versions.',
  )
  .summary(
    'Clients MAY send lower HTTP version for servers that improperly handle higher versions.',
  )
  .done();
