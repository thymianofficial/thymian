import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-interpret-two-digit-years-correctly',
)
  .severity('error')
  // Informational: this MUST governs how the recipient interprets a two-digit
  // rfc850-date year (the 50-year sliding-window rule). It is an internal
  // interpretation decision inside the recipient; it does not alter the bytes
  // of any message, so there is nothing observable for lint, test, or analyze
  // to validate. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'Recipients of a timestamp value in rfc850-date format, which uses a two-digit year, MUST interpret a timestamp that appears to be more than 50 years in the future as representing the most recent year in the past that had the same last two digits.',
  )
  .summary(
    'Recipient MUST interpret two-digit years >50 years in the future as representing the past.',
  )
  .done();
