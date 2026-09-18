import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/client-may-discard-oversized-field-lines')
  .severity('off')
  .type(
    'informational',
    'peer-not-observable',
    "The oversized field line has already arrived on the wire; discarding or truncating it happens inside the client's own parse result. Section 5.4 grants the permission only where the dropped values change neither the message framing nor the response semantics, so nothing the client goes on to send distinguishes it from a client that kept them.",
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
