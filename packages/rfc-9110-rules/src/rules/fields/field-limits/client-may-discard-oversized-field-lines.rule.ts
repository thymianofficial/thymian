import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/client-may-discard-oversized-field-lines')
  .severity('off')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.4')
  .description(
    'A client MAY discard or truncate received field lines that are larger than the client wishes to process if the field semantics are such that the dropped value(s) can be safely ignored without changing the message framing or response semantics.',
  )
  .summary(
    'Client MAY discard or truncate oversized field lines if semantics allow.',
  )
  .appliesTo('client')
  .tags('fields', 'field-limits', 'client')
  .done();
