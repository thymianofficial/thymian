import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-handle-100-continue-expectation')
  .severity('hint')
  // Both permitted proxy behaviours (respond with a final status, or forward
  // toward the origin) are conforming and require proxy role attribution plus
  // forwarding correlation to distinguish.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'Upon receiving an HTTP/1.1 (or later) request that has a method, target URI, and complete header section that contains a 100-continue expectation and indicates a request content will follow, a proxy MUST either send an immediate response with a final status code, or forward the request toward the origin server.',
  )
  .appliesTo('proxy')
  .done();
