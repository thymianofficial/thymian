import { httpRule } from '@thymian/core';

import { redirectRule } from '../utils/redirect.js';

const { lint, test, analytics } = redirectRule();

// Heuristic in every context: the SHOULD binds an HSTS Host, and whether the
// host behind a plain-HTTP listener has chosen to be one is in no exchange —
// a host that never opted into HSTS is not bound by §7.2. The
// `server-should-redirect-insecure-requests-to-https` convention rule asks
// the same of every server, exactly, and replaces this one in `recommended`.
export default httpRule(
  'rfc-6797/hsts-host-should-redirect-insecure-requests-to-https',
)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.2')
  .description(
    'If an HSTS Host receives an HTTP request message over a non-secure transport, it SHOULD send an HTTP response message containing a status code indicating a permanent redirect, such as status code 301, and a Location header field value containing either the HTTP request\'s original Effective Request URI altered as necessary to have a URI scheme of "https", or a URI generated according to local policy with a URI scheme of "https".',
  )
  .summary(
    'HSTS Host should permanently redirect plain-HTTP requests to https.',
  )
  .explanation(
    "A browser that has never seen a host's HSTS Policy still starts with plain HTTP, typically because a user typed the bare domain. Answering that request with a permanent redirect to https moves the user onto a secure connection, where the Strict-Transport-Security header can then be delivered. Serving content over HTTP instead keeps the user there, where any attacker on the network can read and rewrite the traffic; a temporary redirect (302, 307) works too, but is re-requested over HTTP every time.",
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
