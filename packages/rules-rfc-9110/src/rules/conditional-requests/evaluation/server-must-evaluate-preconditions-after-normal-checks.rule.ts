import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-evaluate-preconditions-after-normal-checks',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1')
  .description(
    'Except when excluded below, a recipient cache or origin server MUST evaluate received request preconditions after it has successfully performed its normal request checks and just before it would process the request content (if any) or perform the action associated with the request method.',
  )
  .summary(
    'Server MUST evaluate preconditions after normal checks and before processing request content.',
  )
  .appliesTo('server', 'cache', 'origin server')
  .tags('conditional-requests', 'evaluation', 'timing')
  .done();
