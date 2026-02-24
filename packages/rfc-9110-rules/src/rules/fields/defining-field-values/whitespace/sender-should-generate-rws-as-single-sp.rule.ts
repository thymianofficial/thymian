import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for RWS generation
// Requires detecting RWS positions and validating single SP generation:
//   RWS = 1*( SP / HTAB ) ; required whitespace
// Can be implemented in static context to validate outgoing messages
export default httpRule('rfc9110/sender-should-generate-rws-as-single-sp')
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3')
  .description(
    'The RWS rule is used when at least one linear whitespace octet is required to separate field tokens. A sender SHOULD generate RWS as a single SP.',
  )
  .summary('Sender SHOULD generate required whitespace (RWS) as a single SP.')
  .tags('fields', 'whitespace')
  .done();
