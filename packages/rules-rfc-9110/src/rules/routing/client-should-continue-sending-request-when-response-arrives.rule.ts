import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-continue-sending-request-when-response-arrives',
)
  .severity('warn')
  // This is an internal user-agent behaviour (whether a client keeps sending a
  // request body after an early response arrives). It is a SHOULD about the
  // sender's own send-loop, leaves no distinguishing signal in captured
  // request/response data, and the previous `analytics` typing shipped no rule
  // function. Reclassified to informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-response-correlation')
  .description(
    'A client that receives a response while it is still sending the associated request SHOULD continue sending that request unless it receives an explicit indication to the contrary. All responses can be sent at any time after a request is received, even if the request is not yet complete.',
  )
  .summary(
    'Client SHOULD continue sending request even if response arrives early.',
  )
  .appliesTo('client')
  .done();
