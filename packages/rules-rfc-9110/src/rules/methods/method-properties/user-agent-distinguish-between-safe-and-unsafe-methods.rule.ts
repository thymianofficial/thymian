import { httpRule } from '@thymian/core';

// This SHOULD is about a user agent's *presentation* to a human (surfacing that
// an action is unsafe before it is requested). That is UI/UX behavior with no
// representation on the wire, so it cannot be observed from a request, a
// response, or recorded traffic.
export default httpRule(
  'rfc9110/user-agent-distinguish-between-safe-and-unsafe-methods',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods')
  .description(
    'A user agent SHOULD distinguish between safe and unsafe methods when presenting potential actions to a user, such that the user can be made aware of an unsafe action before it is requested.',
  )
  .appliesTo('user-agent')
  .done();
