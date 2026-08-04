import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-forward-1xx-responses')
  .severity('error')
  // Interim 1xx responses are not represented as discrete transactions in
  // captured traffic (HAR records the final response), so a proxy's forwarding
  // of them cannot be observed.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-informational-1xx')
  .description(
    'A proxy MUST forward 1xx responses unless the proxy itself requested the generation of the 1xx response. For example, if a proxy adds an "Expect: 100-continue" header field when it forwards a request, then it need not forward the corresponding 100 (Continue) response(s).',
  )
  .summary(
    'A proxy MUST forward 1xx responses unless the proxy itself requested the generation of the 1xx response.',
  )
  .appliesTo('proxy')
  .done();
