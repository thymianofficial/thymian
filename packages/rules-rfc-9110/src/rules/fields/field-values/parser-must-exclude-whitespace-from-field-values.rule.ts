import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/parser-must-exclude-whitespace-from-field-values',
)
  .severity('error')
  // Informational (unobservable): stripping leading/trailing whitespace before
  // evaluating a field value is internal recipient parsing behaviour; the
  // trimmed value is not re-emitted, so there is no observable signal.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'When a specific version of HTTP allows such whitespace to appear in a message, a field parsing implementation MUST exclude such whitespace prior to evaluating the field value.',
  )
  .summary(
    'Field parsing implementations MUST exclude leading/trailing whitespace before evaluating field values.',
  )
  .done();
