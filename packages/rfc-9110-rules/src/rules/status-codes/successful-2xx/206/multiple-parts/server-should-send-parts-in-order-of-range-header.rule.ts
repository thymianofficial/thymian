import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-send-parts-in-order-of-range-header',
)
  .severity('warn')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'A server that generates a multipart response SHOULD send the parts in the same order that the corresponding range-spec appeared in the received Range header field, excluding those ranges that were deemed unsatisfiable or that were coalesced into other ranges.',
  )
  .appliesTo('server')
  .done();
