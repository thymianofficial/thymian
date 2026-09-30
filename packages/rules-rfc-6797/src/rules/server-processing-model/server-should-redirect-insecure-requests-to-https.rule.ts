import { httpRule } from '@thymian/core';

import { redirectRuleFns } from '../utils/redirect.js';

const NAME = 'rfc-6797/server-should-redirect-insecure-requests-to-https';

const { lint, test, analytics } = redirectRuleFns(NAME);

// A convention rule, the exact twin of
// `hsts-host-should-redirect-insecure-requests-to-https`: RFC 6797 asks for
// the redirect only from a host that has chosen to be an HSTS Host, which no
// exchange shows, so that rule is heuristic and can never be promoted.
// Asking it of every server drops the condition and makes the check exact,
// so this one ships `off`, covers no unit, and the `recommended` profile
// turns it on in the other's place.
export default httpRule(NAME)
  .severity('off')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.2')
  .description(
    'A server should answer every request over non-secure transport with a permanent redirect to the resource over https. RFC 6797 asks this only of an HSTS Host; this is a convention.',
  )
  .summary('Server should permanently redirect plain-HTTP requests to https.')
  .explanation(
    'RFC 6797 asks for this redirect only from a host that has already chosen to be an HSTS Host, and the recommended profile requires it of every server because a plain-HTTP request not answered by a permanent redirect — typically a typed bare domain on a first visit — is exactly the downgrade window HSTS exists to close, and the one place its header can never be delivered.',
  )
  .appliesTo('server')
  // Overridden in all three contexts: whether the redirect names an https
  // target is in the Location's value, which the common interface cannot
  // see, and each context judges it its own way — once per operation over
  // the declared responses in `static`, without the status-code check in
  // `test`, per recorded answer in `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
