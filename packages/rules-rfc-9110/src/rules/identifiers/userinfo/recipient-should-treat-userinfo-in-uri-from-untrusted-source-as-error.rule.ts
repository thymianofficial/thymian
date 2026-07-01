import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error',
)
  .severity('warn')
  // Informational (#327): unobservable. The check was gated on userinfo present
  // in the request target URI, but HAR ingestion normalizes the URI via
  // `new URL(url).origin`, which STRIPS userinfo before we see it, so the
  // predicate is vacuous (can never fire) and the response-status half never
  // runs. Detecting whether the recipient treated userinfo as an error also
  // requires the raw target-URI userinfo that ingestion discarded, so this is
  // not observable from recorded traffic. Any surviving userinfo lives only in
  // URI-bearing header values (e.g. Referer), covered elsewhere.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-deprecation-of-userinfo-in-http',
  )
  .description(
    `A recipient SHOULD parse for userinfo and treat its presence as an error; it is likely being used to obscure the authority for the sake of phishing attacks.`,
  )
  .appliesTo('origin server', 'server')
  .done();
