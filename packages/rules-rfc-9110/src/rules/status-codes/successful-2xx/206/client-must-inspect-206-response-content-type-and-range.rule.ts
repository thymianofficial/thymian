import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-inspect-206-response-content-type-and-range',
)
  .severity('error')
  .type('informational')
  .appliesTo('client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-206-partial-content')
  .description(
    `A client MUST inspect a 206 response's Content-Type and Content-Range field(s) to determine what parts are enclosed and whether additional requests are needed.`,
  )
  .done();
