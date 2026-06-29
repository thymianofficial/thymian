import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-handle-100-continue-expectation')
  .severity('hint')
  // Informational (#327): a MUST whose conformant outcomes (send an immediate
  // final status OR forward the request) cannot be distinguished from
  // non-conformant behaviour without observing the proxy's ingress AND egress
  // for the same message. That cross-hop correlation at a proxy is not
  // reconstructable from a standard captured transaction / HAR, so this is not
  // turned into an analytics check. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'Upon receiving an HTTP/1.1 (or later) request that has a method, target URI, and complete header section that contains a 100-continue expectation and indicates a request content will follow, a proxy MUST either send an immediate response with a final status code, or forward the request toward the origin server.',
  )
  .appliesTo('proxy')
  .done();
