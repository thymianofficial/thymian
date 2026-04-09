import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/http-component-may-perform-normalization')
  .severity('warn')
  .type('static')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-normalization-and-comparison',
  )
  .description(`Any HTTP component MAY perform normalization.`)
  .done();
