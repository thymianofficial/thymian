import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/recipient-may-treat-the-set-of-received-trailer-fields-as-name-value-pairs',
)
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    'Whether a recipient models the received trailer section as name/value pairs or as some other structure is a choice inside its own parser. The trailer field lines on the wire are identical either way, and nothing the recipient emits reveals which representation it picked.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.2')
  .description(
    'At the end of a message, a recipient MAY treat the set of received trailer fields as a data structure of name/value pairs, similar to (but separate from) the header fields. Additional processing expectations, if any, can be defined within the field specification for a field intended for use in trailers.',
  )
  .summary(
    'Recipient MAY treat the set of received trailer fields as a data structure of name/value pairs.',
  )
  .done();
