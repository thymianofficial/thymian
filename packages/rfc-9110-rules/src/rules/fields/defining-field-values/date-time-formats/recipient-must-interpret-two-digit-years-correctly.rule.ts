import { httpRule } from '@thymian/core';

// TODO: Implement ABNF validation and logic for two-digit year interpretation
// Requires parsing rfc850-date format and applying 50-year rule for 2-digit years
export default httpRule(
  'rfc9110/recipient-must-interpret-two-digit-years-correctly',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'Recipients of a timestamp value in rfc850-date format, which uses a two-digit year, MUST interpret a timestamp that appears to be more than 50 years in the future as representing the most recent year in the past that had the same last two digits.',
  )
  .summary(
    'Recipient MUST interpret two-digit years >50 years in the future as representing the past.',
  )
  .tags('fields', 'date-time', 'parsing')
  .done();
