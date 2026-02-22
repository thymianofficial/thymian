import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for field-value format (field-content, field-vchar)
// Requires parsing field-value ABNF to detect and validate whitespace handling:
//   field-value = *field-content
//   field-content = field-vchar [ 1*( SP / HTAB / field-vchar ) field-vchar ]
export default httpRule(
  'rfc9110/parser-must-exclude-whitespace-from-field-values',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5')
  .description(
    'When a specific version of HTTP allows such whitespace to appear in a message, a field parsing implementation MUST exclude such whitespace prior to evaluating the field value.',
  )
  .summary(
    'Field parsing implementations MUST exclude leading/trailing whitespace before evaluating field values.',
  )
  .appliesTo('client', 'server', 'proxy', 'intermediary')
  .tags('fields', 'field-values', 'parsing')
  .done();
