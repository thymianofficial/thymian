import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-send-lower-version-for-broken-servers',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A MAY: the HTTP version token is not exposed by the rule framework, and this is a conditional allowance after a prior failed request — nothing is non-conformant either way.',
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
