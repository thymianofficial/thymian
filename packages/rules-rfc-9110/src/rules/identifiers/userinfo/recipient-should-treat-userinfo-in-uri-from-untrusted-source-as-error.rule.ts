import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error',
)
  .severity('warn')
  // HAR ingestion normalizes the request target URI via `new URL(url).origin`,
  // which STRIPS userinfo before we see it. Detecting whether the recipient
  // treated userinfo as an error requires the raw target-URI userinfo that
  // ingestion discarded, so it is not observable from recorded traffic. Any
  // surviving userinfo lives only in URI-bearing header values (e.g. Referer),
  // covered elsewhere.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-deprecation-of-userinfo-in-http',
  )
  .description(
    `A recipient SHOULD parse for userinfo and treat its presence as an error; it is likely being used to obscure the authority for the sake of phishing attacks.`,
  )
  .appliesTo('origin server', 'server')
  .done();
