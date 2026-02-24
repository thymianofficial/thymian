import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for unnecessary OWS detection
// Requires detecting OWS where not needed for readability
// Can be implemented in static context to validate outgoing messages
export default httpRule(
  'rfc9110/sender-should-not-generate-ows-except-when-needed',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'For protocol elements where optional whitespace is preferred to improve readability, a sender SHOULD generate the optional whitespace as a single SP; otherwise, a sender SHOULD NOT generate optional whitespace except as needed to overwrite invalid or unwanted protocol elements during in-place message filtering.',
  )
  .summary(
    'Sender SHOULD NOT generate optional whitespace except when needed for overwriting invalid elements.',
  )
  .tags('fields', 'whitespace')
  .done();
