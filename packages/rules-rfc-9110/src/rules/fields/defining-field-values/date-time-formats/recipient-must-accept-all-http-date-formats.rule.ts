import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-must-accept-all-http-date-formats')
  .severity('error')
  // A recipient's internal parsing acceptance of all three HTTP-date formats
  // leaves no signal on the wire — Thymian cannot see whether the peer accepted
  // a given inbound timestamp format.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7')
  .description(
    'A recipient that parses a timestamp value in an HTTP field MUST accept all three HTTP-date formats.',
  )
  .summary(
    'Recipient parsing timestamp values MUST accept all three HTTP-date formats.',
  )
  .done();
