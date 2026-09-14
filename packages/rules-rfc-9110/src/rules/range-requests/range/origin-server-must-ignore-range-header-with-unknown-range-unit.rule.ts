import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-must-ignore-range-header-with-unknown-range-unit',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    "Ignoring means the origin server processes the request as though the Range header were absent. Both the conformant outcome and the non-conformant one depend on the server's internal understanding of the unit — not observable on the wire, and whether a unit is unknown is server-specific.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'An origin server MUST ignore a Range header field that contains a range unit it does not understand.',
  )
  .summary(
    'An origin server must ignore a Range header field that contains a range unit it does not understand.',
  )
  .appliesTo('origin server')
  .done();
