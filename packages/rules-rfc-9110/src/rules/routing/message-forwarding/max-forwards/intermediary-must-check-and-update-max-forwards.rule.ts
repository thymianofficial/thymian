import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-check-and-update-max-forwards',
)
  .severity('error')
  // OUTCOME 3 (infrastructure-deferred): verifying the intermediary checked and
  // decremented Max-Forwards requires comparing the value received by the
  // intermediary with the value it forwarded — a before/after linkage only
  // available from traffic recorded AT the intermediary, not from a single
  // transaction or typical HAR. Stays analytics with NO rule function.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'Each intermediary that receives a TRACE or OPTIONS request containing a Max-Forwards header field MUST check and update its value prior to forwarding the request. The Max-Forwards mechanism limits the number of times a request can be forwarded.',
  )
  .summary('Intermediary MUST check and update Max-Forwards value.')
  .appliesTo('intermediary')
  .done();
