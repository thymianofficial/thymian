import { httpRule } from '@thymian/http-linter';

// also analytics rule in the future
export default httpRule('rfc9110/proxy-must-not-modify-allow-header')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description('A proxy MUST NOT modify the Allow header field.')
  .appliesTo('proxy')
  .done();
