import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-modify-allow-header')
  .severity('hint')
  // Informational (#327): detecting a *modification* requires comparing the
  // Allow value the proxy received from upstream against the value it forwarded
  // downstream — i.e. correlating the same response at two hops. That cross-hop
  // view is not reconstructable from a standard captured transaction / HAR, so
  // this is not turned into an analytics check. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description('A proxy MUST NOT modify the Allow header field.')
  .appliesTo('proxy')
  .done();
