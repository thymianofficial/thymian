import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-reject-https-requests-without-valid-certificate',
)
  .severity('error')
  // SECURITY-RELEVANT (misdirected-request / certificate validation):
  // conformance depends on the TLS/connection layer — whether the request
  // arrived over a connection secured by a certificate valid for the target
  // URI's origin. That is a transport-layer property not represented in the
  // HTTP message/transaction data Thymian validates, so it cannot be checked by
  // lint/test/analyze. Kept informational.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-rejecting-misdirected-reque',
  )
  .description(
    'Unless the connection is from a trusted gateway, an origin server MUST reject a request for an "https" resource unless it has been received over a connection that has been secured via a certificate valid for that target URI\'s origin, as defined by Section 4.2.2.',
  )
  .summary(
    'Origin server MUST reject HTTPS requests not received over properly secured connections.',
  )
  .appliesTo('origin server')
  .done();
