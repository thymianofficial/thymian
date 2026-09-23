import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc-6797/https-redirect-is-should-for-deployment-reasons',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A note explaining why the redirect before it is a SHOULD rather than a MUST; it states no requirement a message could meet or break. The SHOULD itself is checked by hsts-host-should-redirect-insecure-requests-to-https.',
  )
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.2')
  .description(
    'The above behavior is a "SHOULD" rather than a "MUST" due to: risks in server-side non-secure-to-secure redirects [OWASP-TLSGuide]; and site deployment characteristics — for example, a site that incorporates third-party components may not behave correctly when doing server-side non-secure-to-secure redirects in the case of being accessed over non-secure transport, but does behave correctly when accessed uniformly over secure transport.',
  )
  .summary(
    'Redirecting plain-HTTP requests to https is a SHOULD for deployment reasons.',
  )
  .appliesTo('server')
  .done();
