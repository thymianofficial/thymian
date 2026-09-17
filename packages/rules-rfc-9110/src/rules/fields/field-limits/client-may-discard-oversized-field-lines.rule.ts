import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/client-may-discard-oversized-field-lines')
  .severity('off')
  .type(
    'informational',
    'nothing-to-check',
    'Discarding/truncating oversized field lines is optional internal client behaviour with no required outcome.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.4')
  .description(
    'A client MAY discard or truncate received field lines that are larger than the client wishes to process if the field semantics are such that the dropped value(s) can be safely ignored without changing the message framing or response semantics.',
  )
  .summary(
    'Client MAY discard or truncate oversized field lines if semantics allow.',
  )
  .appliesTo('client')
  .done();
