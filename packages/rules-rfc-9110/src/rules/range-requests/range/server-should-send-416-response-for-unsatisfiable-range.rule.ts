import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-send-416-response-for-unsatisfiable-range',
)
  .severity('warn')
  // Informational (outcome 2): the SHOULD is gated on server-internal
  // preconditions — Range is supported, the ranges-specifier is valid, and the
  // range-unit is unsupported OR the range is unsatisfiable against the selected
  // representation. "Unsatisfiable"/"unsupported unit" cannot be determined from
  // the spec or recorded traffic without knowing the representation length and
  // the server's supported units, so the trigger is unobservable. (Symmetric to
  // server-should-send-206-response-for-satisfiable-range.)
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
