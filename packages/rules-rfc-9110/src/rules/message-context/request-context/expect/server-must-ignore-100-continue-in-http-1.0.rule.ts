import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-must-ignore-100-continue-in-http-1.0')
  .severity('hint')
  // Informational (#327): conformance turns on the request's HTTP *version*
  // (the expectation must be ignored for HTTP/1.0). The protocol version is not
  // exposed by the common projection nor by the live request/response model
  // available here, and "ignore" is itself a non-action with no observable
  // signature. No detectable non-conformant case in the current framework, so
  // it stays informational. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that receives a 100-continue expectation in an HTTP/1.0 request MUST ignore that expectation.',
  )
  .appliesTo('server')
  .done();
