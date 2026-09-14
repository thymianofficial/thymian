import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-reject-requests-not-meeting-scheme-requirements',
)
  .severity('error')
  .type(
    'informational',
    'origin-internal-ground-truth',
    'Judging whether a request met the scheme requirements needs the connection/transport context (e.g. TLS state) that only the origin server itself observes; not available from the HTTP message alone.',
  )
  .tags('security:transport')
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
