import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-send-416-response-for-unsatisfiable-range',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'If all of the preconditions are true, the server supports the Range header field for the target resource, the received Range field-value contains a valid ranges-specifier, and either the range-unit is not supported for that target resource or the ranges-specifier is unsatisfiable with respect to the selected representation, the server SHOULD send a 416 (Range Not Satisfiable) response.',
  )
  .summary(
    'Server should send 416 response when Range header is valid but range-unit is unsupported or range is unsatisfiable.',
  )
  .appliesTo('server')
  .done();
