import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-must-respond-4xx-for-oversized-fields')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.4')
  .description(
    'A server that receives a request header field line, field value, or set of fields larger than it wishes to process MUST respond with an appropriate 4xx (Client Error) status code.',
  )
  .summary(
    'Server MUST respond with 4xx status code when receiving oversized fields.',
  )
  .appliesTo('server')
  .tags('fields', 'field-limits', 'server')
  .done();
