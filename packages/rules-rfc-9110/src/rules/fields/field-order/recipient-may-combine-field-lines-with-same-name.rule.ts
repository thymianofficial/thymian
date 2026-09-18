import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/recipient-may-combine-field-lines-with-same-name',
)
  .severity('off')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#120',
    'A recipient that takes this up and forwards the message emits one field line where the inbound message carried several, joined by comma and OWS; Section 5.3 addresses its next paragraph to a proxy forwarding those same lines, so the recombined form does reach the wire. Rules cannot see it: field lines sharing a name are not kept distinct through parsing, and no context has a count primitive.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3')
  .description(
    'A recipient MAY combine multiple field lines within a field section that have the same field name into one field line, without changing the semantics of the message, by appending each subsequent field line value to the initial field line value in order, separated by a comma (",") and optional whitespace (OWS, defined in Section 5.6.3).',
  )
  .summary(
    'Recipient MAY combine multiple field lines with the same name into one field line.',
  )
  .done();
