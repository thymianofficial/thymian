import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/parser-must-exclude-whitespace-from-field-values',
)
  .severity('error')
  // Informational: this MUST governs the recipient's internal field parser (it
  // must strip leading/trailing whitespace before evaluating a value). It is
  // an internal parsing behavior with no observable signal in the messages
  // Thymian can lint, test, or analyze, and the HTTP layer has already trimmed
  // such whitespace before Thymian sees parsed values. Recorded for
  // documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'When a specific version of HTTP allows such whitespace to appear in a message, a field parsing implementation MUST exclude such whitespace prior to evaluating the field value.',
  )
  .summary(
    'Field parsing implementations MUST exclude leading/trailing whitespace before evaluating field values.',
  )
  .done();
