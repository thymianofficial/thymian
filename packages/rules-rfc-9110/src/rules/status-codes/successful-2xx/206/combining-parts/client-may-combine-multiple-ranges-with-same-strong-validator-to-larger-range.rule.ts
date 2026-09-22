import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-combine-multiple-ranges-with-same-strong-validator-to-larger-range',
)
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    "The larger continuous range is assembled in the client's own copy of the representation and is never sent, so no later request and no response carries whether the partial responses were combined.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-combining-parts')
  .description(
    'A client that has received multiple partial responses to GET requests on a target resource MAY combine those responses into a larger continuous range if they share the same strong validator.',
  )
  .appliesTo('client')
  .done();
