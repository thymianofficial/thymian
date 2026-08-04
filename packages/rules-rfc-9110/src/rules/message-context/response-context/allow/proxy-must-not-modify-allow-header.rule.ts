import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-not-modify-allow-header')
  .severity('hint')
  // Detecting a proxy "modifying" Allow requires comparing the field value
  // across adjacent proxy hops. This is a candidate for a captured-trace
  // analytics check, but only where per-hop recorded traffic with proxy role is
  // available.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description('A proxy MUST NOT modify the Allow header field.')
  .appliesTo('proxy')
  .done();
