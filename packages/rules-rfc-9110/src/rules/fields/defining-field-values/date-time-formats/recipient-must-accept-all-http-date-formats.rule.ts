import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-must-accept-all-http-date-formats')
  .severity('error')
  // Informational: this MUST constrains the recipient's internal parser — it
  // must accept all three HTTP-date formats (IMF-fixdate, rfc850-date,
  // asctime-date). Whether a recipient accepts a given format is an internal
  // implementation property that produces no observable signal in the
  // request/response that Thymian can lint, test, or analyze. There is no
  // conformant-vs-nonconformant difference visible on the wire, so the rule is
  // recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'A recipient that parses a timestamp value in an HTTP field MUST accept all three HTTP-date formats.',
  )
  .summary(
    'Recipient parsing timestamp values MUST accept all three HTTP-date formats.',
  )
  .done();
