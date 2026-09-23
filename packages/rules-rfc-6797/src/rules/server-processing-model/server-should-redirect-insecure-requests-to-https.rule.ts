import { httpRule } from '@thymian/core';

import { redirectRule } from '../utils/redirect.js';

const { lint, test, analytics } = redirectRule();

// A convention rule, the exact twin of
// `hsts-host-should-redirect-insecure-requests-to-https`: RFC 6797 asks for
// the redirect only from a host that has chosen to be an HSTS Host, which no
// exchange shows, so that rule is heuristic and can never be promoted. Asking
// it of every server drops the condition and makes the check exact, so this
// one ships `off` and the `recommended` profile turns it on in the other's
// place.
export default httpRule(
  'rfc-6797/server-should-redirect-insecure-requests-to-https',
)
  .severity('off')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.2')
  .description(
    'A server should answer every request over non-secure transport with a permanent redirect to the resource over https. RFC 6797 asks this only of an HSTS Host; this is a convention.',
  )
  .summary('Server should permanently redirect plain-HTTP requests to https.')
  .explanation(
    'RFC 6797 asks for this redirect only from a host that has chosen to be an HSTS Host, and the recommended profile requires it of every server because a plain-HTTP request left unanswered by a redirect — typically a typed bare domain on a first visit — is exactly the downgrade window HSTS exists to close, and the one place its header can never be delivered.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
