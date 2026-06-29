import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-send-206-response-for-satisfiable-range',
)
  .severity('warn')
  // Informational (outcome 2): the SHOULD only applies once a chain of
  // server-internal preconditions all hold — the server supports Range for the
  // target resource, the ranges-specifier is valid with a supported range-unit,
  // AND it is satisfiable against the selected representation. None of those
  // facts are observable from the spec or from recorded traffic. The previous
  // static rule flagged every Range request not answered with 206, but 200
  // (Range ignored — explicitly allowed), 416 (unsatisfiable), and 304 (Not
  // Modified) are all conformant responses, so that check is false-positive-
  // ridden. With undeterminable preconditions, this is informational.
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
