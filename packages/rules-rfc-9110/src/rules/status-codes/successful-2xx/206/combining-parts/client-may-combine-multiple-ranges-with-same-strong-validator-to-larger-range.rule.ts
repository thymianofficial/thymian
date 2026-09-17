import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-combine-multiple-ranges-with-same-strong-validator-to-larger-range',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A MAY describing internal client range-combining behavior; no non-conformant condition to observe.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-combining-parts')
  .description(
    'A client that has received multiple partial responses to GET requests on a target resource MAY combine those responses into a larger continuous range if they share the same strong validator.',
  )
  .appliesTo('client')
  .done();
