import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-must-respond-4xx-for-oversized-fields')
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#110',
    "Triggering this rule requires sending a request whose header field line/value/set exceeds the server's internal processing limit; Thymian generates well-formed requests from the spec rather than deliberately oversized ones, so the condition cannot be provoked today.",
  )
  .tags('security:dos')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.4')
  .description(
    'A server that receives a request header field line, field value, or set of fields larger than it wishes to process MUST respond with an appropriate 4xx (Client Error) status code.',
  )
  .summary(
    'Server MUST respond with 4xx status code when receiving oversized fields.',
  )
  .appliesTo('server')
  .done();
