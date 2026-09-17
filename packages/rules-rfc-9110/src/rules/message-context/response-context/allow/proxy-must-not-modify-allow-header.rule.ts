import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/proxy-must-not-modify-allow-header')
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    'Detecting a proxy modifying Allow requires comparing the field value across adjacent proxy hops, which is not observable from a single vantage point.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-allow')
  .description('A proxy MUST NOT modify the Allow header field.')
  .appliesTo('proxy')
  .done();
