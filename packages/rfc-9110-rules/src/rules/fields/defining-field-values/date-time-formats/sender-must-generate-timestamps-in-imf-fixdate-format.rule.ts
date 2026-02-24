import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for IMF-fixdate generation
// Requires validating HTTP-date follows IMF-fixdate format:
//   IMF-fixdate = day-name "," SP date1 SP time-of-day SP GMT
// Can be implemented in static context to validate outgoing messages
export default httpRule(
  'rfc9110/sender-must-generate-timestamps-in-imf-fixdate-format',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'When a sender generates a field that contains one or more timestamps defined as HTTP-date, the sender MUST generate those timestamps in the IMF-fixdate format.',
  )
  .summary(
    'Sender MUST generate HTTP-date timestamps in the IMF-fixdate format.',
  )
  .tags('fields', 'date-time')
  .done();
