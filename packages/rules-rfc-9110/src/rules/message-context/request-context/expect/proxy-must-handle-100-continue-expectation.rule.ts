import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/proxy-must-handle-100-continue-expectation')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A conforming proxy answers a 100-continue request with a final status of its own or forwards it on, and a captured trace carries either outcome: the response, or the forwarded request marked with the intermediary role. Detecting the proxy that does neither is not written as a check yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'Upon receiving an HTTP/1.1 (or later) request that has a method, target URI, and complete header section that contains a 100-continue expectation and indicates a request content will follow, a proxy MUST either send an immediate response with a final status code, or forward the request toward the origin server.',
  )
  .appliesTo('proxy')
  .done();
