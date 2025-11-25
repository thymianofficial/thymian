import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-must-inspect-content-range-header-in-multiple-parts-206-response',
)
  .severity('error')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'A client that receives a multipart response MUST inspect the Content-Range header field present in each body part in order to determine which range is contained in that body part; a client cannot rely on receiving the same ranges that it requested, nor the same order that it requested.',
  )
  .appliesTo('client')
  .done();
