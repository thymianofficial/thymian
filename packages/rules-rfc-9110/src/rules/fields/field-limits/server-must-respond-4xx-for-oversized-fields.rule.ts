import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-must-respond-4xx-for-oversized-fields')
  .severity('error')
  // Informational: validating this MUST requires sending a request whose
  // header field line / value / set exceeds the server's limit and observing a
  // 4xx, but the response depends on the server's (unknown, deployment- and
  // resource-specific) limit, and Thymian's HTTP stack does not let a rule
  // craft a deliberately oversized request to provoke it. In recorded traffic
  // the over-limit request that triggered a 4xx is rarely present, and a 4xx
  // alone is not attributable to field size. No reliable observable condition
  // exists, so it is recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.4')
  .description(
    'A server that receives a request header field line, field value, or set of fields larger than it wishes to process MUST respond with an appropriate 4xx (Client Error) status code.',
  )
  .summary(
    'Server MUST respond with 4xx status code when receiving oversized fields.',
  )
  .appliesTo('server')
  .done();
