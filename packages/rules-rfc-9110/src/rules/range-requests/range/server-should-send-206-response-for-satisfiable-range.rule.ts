import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-send-206-response-for-satisfiable-range',
)
  .severity('warn')
  // Informational (outcome 2): the SHOULD applies only once server-internal
  // preconditions all hold (Range supported for the resource, valid specifier
  // with a supported unit, and satisfiable against the selected representation) —
  // none observable. 200 (Range ignored), 416, and 304 are all conformant, so
  // flagging "not 206" is false-positive-ridden.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'If all of the preconditions are true, the server supports the Range header field for the target resource, the received Range field-value contains a valid ranges-specifier with a range-unit supported for that target resource, and that ranges-specifier is satisfiable with respect to the selected representation, the server SHOULD send a 206 (Partial Content) response with content containing one or more partial representations that correspond to the satisfiable range-spec(s) requested.',
  )
  .summary(
    'Server should send 206 response when Range header conditions are met and range is satisfiable.',
  )
  .appliesTo('origin server')
  .done();
