import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/http-component-may-perform-normalization')
  .severity('hint')
  // Reclassified static -> informational (outcome 4 then outcome 2). Previously
  // declared `static` with no rule function. This is a purely permissive MAY:
  // any HTTP component is *allowed* to normalize URIs. There is no
  // non-conformant condition to detect — performing or not performing
  // normalization are both conformant — so nothing can be validated by lint,
  // test, or analyze. Severity lowered from warn to hint to match a permissive
  // statement. Kept as documentation.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-normalization-and-comparison',
  )
  .description(`Any HTTP component MAY perform normalization.`)
  .done();
