import { httpRule } from '@thymian/http-linter';

// TODO: Implement ABNF validation for HTTP-date parsing
// Requires parsing all three HTTP-date formats:
//   HTTP-date = IMF-fixdate / obs-date
//   obs-date = rfc850-date / asctime-date
export default httpRule('rfc9110/recipient-must-accept-all-http-date-formats')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'A recipient that parses a timestamp value in an HTTP field MUST accept all three HTTP-date formats.',
  )
  .summary(
    'Recipient parsing timestamp values MUST accept all three HTTP-date formats.',
  )
  .tags('fields', 'date-time', 'parsing')
  .done();
