import { httpRule } from '@thymian/core';

// A NOTE the counting rule counts because it quotes a keyword to explain
// one: a unit, but nothing any message could conform to or violate.
export default httpRule(
  'rfc-6797/https-redirect-is-should-for-deployment-reasons',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A note explaining why the redirect before it is a SHOULD rather than a MUST; it states no requirement a message could meet or break. The redirect itself is checked by hsts-host-should-redirect-insecure-requests-to-https and, in the recommended profile, by the server-should-redirect-insecure-requests-to-https convention rule.',
  )
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.2')
  .description(
    'NOTE: The above behavior is a "SHOULD" rather than a "MUST" due to: risks in server-side non-secure-to-secure redirects [OWASP-TLSGuide]; and site deployment characteristics. For example, a site that incorporates third-party components may not behave correctly when doing server-side non-secure-to-secure redirects in the case of being accessed over non-secure transport but does behave correctly when accessed uniformly over secure transport. The latter is the case given an HSTS-capable UA that has already noted the site as a Known HSTS Host (by whatever means, e.g., prior interaction or UA configuration).',
  )
  .summary(
    'Redirecting plain-HTTP requests to https is a SHOULD for deployment reasons.',
  )
  .explanation(
    "RFC 6797 leaves the redirect a SHOULD because a server-side redirect from http to https carries risks of its own, and because a site built from third-party components can break when redirected mid-visit although it works when reached over https from the start — which is how a browser that already knows the host's policy reaches it.",
  )
  .appliesTo('server')
  .done();
