import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-select-redirection-from-content',
)
  .severity('hint')
  // Permissive MAY describing an internal user-agent decision (whether to
  // automatically select a redirection from the 300 response content). Both
  // selecting and not selecting are conformant, so there is no non-conformant
  // condition to observe from request/response traffic.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-300-multiple-choices')
  .description(
    'The user agent MAY make a selection from that list automatically if it understands the provided media type.',
  )
  .appliesTo('user-agent')
  .done();
