import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-check-and-update-max-forwards',
)
  .severity('error')
  // Infra-deferred: verifying an intermediary checked and decremented Max-Forwards
  // requires correlating the value it RECEIVED against the value it FORWARDED at the
  // same hop. That inbound-vs-forwarded pairing is only recoverable from captured
  // multi-hop traces at a deployment where the intermediary role is recorded.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-max-forwards')
  .description(
    'Each intermediary that receives a TRACE or OPTIONS request containing a Max-Forwards header field MUST check and update its value prior to forwarding the request. The Max-Forwards mechanism limits the number of times a request can be forwarded.',
  )
  .summary('Intermediary MUST check and update Max-Forwards value.')
  .appliesTo('intermediary')
  .done();
