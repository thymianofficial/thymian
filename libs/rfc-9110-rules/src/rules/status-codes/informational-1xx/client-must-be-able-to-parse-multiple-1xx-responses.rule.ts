import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-must-be-able-to-parse-multiple-1xx-responses'
)
  .severity('error')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-informational-1xx')
  .description(
    'A client MUST be able to parse one or more 1xx responses received prior to a final response, even if the client does not expect one.'
  )
  .summary(
    'A client MUST be able to parse one or more 1xx responses received prior to a final response, even if the client does not expect one.'
  )
  .appliesTo('client')
  .done();
