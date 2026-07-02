import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-ignore-upgrade-in-http-1.0-request',
)
  .severity('error')
  // Confirming the server ignored Upgrade on an HTTP/1.0 request requires knowing it did NOT act on it; a compliant server produces an ordinary response indistinguishable from one that never received Upgrade.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server that receives an Upgrade header field in an HTTP/1.0 request MUST ignore that Upgrade field. Protocol switching is only supported in HTTP/1.1 and later versions.',
  )
  .summary('Server MUST ignore Upgrade header in HTTP/1.0 requests.')
  .appliesTo('server')
  .done();
