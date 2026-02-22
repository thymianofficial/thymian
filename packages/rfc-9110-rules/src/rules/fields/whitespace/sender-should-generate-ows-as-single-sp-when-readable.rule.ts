import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for OWS generation
// Requires detecting OWS positions and validating single SP generation:
//   OWS = *( SP / HTAB ) ; optional whitespace
// Can be implemented in static context to validate outgoing messages
export default httpRule(
  'rfc9110/sender-should-generate-ows-as-single-sp-when-readable',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'For protocol elements where optional whitespace is preferred to improve readability, a sender SHOULD generate the optional whitespace as a single SP; otherwise, a sender SHOULD NOT generate optional whitespace except as needed to overwrite invalid or unwanted protocol elements during in-place message filtering.',
  )
  .summary(
    'Sender SHOULD generate optional whitespace (OWS) as a single SP when preferred for readability.',
  )
  .appliesTo('client', 'server')
  .tags('fields', 'whitespace')
  .done();
