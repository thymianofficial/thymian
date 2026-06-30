import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-reject-requests-not-meeting-scheme-requirements',
)
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-rejecting-misdirected-reque',
  )
  .description(
    'Unless the connection is from a trusted gateway, an origin server MUST reject a request if any scheme-specific requirements for the target URI are not met. This is important for security to prevent misdirected requests, bypass attempts, or content delivery to unintended recipients.',
  )
  .summary(
    'Origin server MUST reject requests that do not meet scheme-specific requirements.',
  )
  .appliesTo('origin server')
  .done();
