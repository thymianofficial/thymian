import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-should-ingore-unrecognized-header-and-trailer-fields-received-in-put-request',
)
  .severity('warn')
  .type(
    'informational',
    'peer-not-observable',
    'Whether unrecognized PUT header/trailer fields are (not) persisted as resource state is an internal server processing decision that produces no observable signal in the response or in recorded traffic.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'An origin server SHOULD ignore unrecognized header and trailer fields received in a PUT request (i.e., not save them as part of the resource state).',
  )
  .appliesTo('origin server')
  .done();
