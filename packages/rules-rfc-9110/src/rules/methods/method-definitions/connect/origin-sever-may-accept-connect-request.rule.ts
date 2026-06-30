import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-sever-may-accept-connect-request')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'An origin server MAY accept a CONNECT request, but most origin servers do not implement CONNECT',
  )
  .appliesTo('origin server')
  .done();
