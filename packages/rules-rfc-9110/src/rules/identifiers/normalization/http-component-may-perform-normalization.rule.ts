import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/http-component-may-perform-normalization')
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A permissive MAY with no observable failure mode — it grants a normalization permission, so there is no violation to detect from recorded traffic.',
  )
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-normalization-and-comparison',
  )
  .description(`Any HTTP component MAY perform normalization.`)
  .done();
