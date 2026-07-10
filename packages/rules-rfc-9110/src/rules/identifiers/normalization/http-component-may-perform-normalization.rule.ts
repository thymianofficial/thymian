import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/http-component-may-perform-normalization')
  .severity('hint')
  // Permissive MAY with no observable failure mode — it grants a normalization
  // permission, so there is no violation to detect from recorded traffic.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-normalization-and-comparison',
  )
  .description(`Any HTTP component MAY perform normalization.`)
  .done();
