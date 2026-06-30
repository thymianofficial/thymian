import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-sever-may-send-allow-header')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description('Origin server MAY send "Allow" header field in response.')
  .appliesTo('origin server')
  .done();
