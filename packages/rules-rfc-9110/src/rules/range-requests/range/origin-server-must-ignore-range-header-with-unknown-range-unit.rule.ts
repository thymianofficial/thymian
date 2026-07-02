import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-ignore-range-header-with-unknown-range-unit',
)
  .severity('error')
  // "ignore" means the origin server processes the request as though the Range
  // header were absent. Both the conformant outcome (a normal 200) and the
  // non-conformant one depend on the server's internal understanding of the unit —
  // not observable on the wire, and whether a unit is "unknown" is server-specific.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'An origin server MUST ignore a Range header field that contains a range unit it does not understand.',
  )
  .summary(
    'An origin server must ignore a Range header field that contains a range unit it does not understand.',
  )
  .appliesTo('origin server')
  .done();
