import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-may-generate-multiple-parts-response-with-single-body'
)
  .severity('hint')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'A server MAY generate a "multipart/byteranges" response with only a single body part if multiple ranges were requested and only one range was found to be satisfiable or only one range remained after coalescing.'
  )
  .appliesTo('server')
  .done();
