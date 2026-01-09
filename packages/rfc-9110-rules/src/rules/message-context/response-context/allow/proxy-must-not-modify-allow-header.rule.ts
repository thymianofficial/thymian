import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-not-modify-allow-header')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description(
    'A proxy MUST NOT modify the Allow header field -- it does not need to understand all of the indicated methods in order to handle them according to the generic message handling rules.',
  )
  .appliesTo('proxy')
  .done();
