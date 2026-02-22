import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for HTTP-date whitespace
// Requires validating only specified SP characters in IMF-fixdate format
// Can be implemented in static context to validate outgoing messages
export default httpRule(
  'rfc9110/sender-must-not-generate-additional-whitespace-in-http-date',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'A sender MUST NOT generate additional whitespace in an HTTP-date beyond that specifically included as SP in the grammar.',
  )
  .summary(
    'Sender MUST NOT generate additional whitespace in HTTP-date beyond the grammar.',
  )
  .appliesTo('client', 'server')
  .tags('fields', 'date-time', 'whitespace')
  .done();
