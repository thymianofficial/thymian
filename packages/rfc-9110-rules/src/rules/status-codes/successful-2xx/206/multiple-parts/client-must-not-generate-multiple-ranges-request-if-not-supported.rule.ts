import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-not-generate-multiple-ranges-request-if-not-supported',
)
  .severity('error')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'A client that cannot process a "multipart/byteranges" response MUST NOT generate a request that asks for multiple ranges.',
  )
  .appliesTo('client')
  .done();
