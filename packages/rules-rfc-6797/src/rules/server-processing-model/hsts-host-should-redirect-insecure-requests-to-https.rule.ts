import { httpRule } from '@thymian/core';

import { redirectRuleFns } from '../utils/redirect.js';

const NAME = 'rfc-6797/hsts-host-should-redirect-insecure-requests-to-https';

const { lint, test, analytics } = redirectRuleFns(NAME);

// Heuristic in every context: the SHOULD binds an HSTS Host, and whether the
// host behind a plain-http listener has chosen to be one is in no exchange —
// a host that never opted into HSTS is not bound by §7.2. A heuristic rule is
// never promoted, so the
// `server-should-redirect-insecure-requests-to-https` convention rule asks
// the same of every server, exactly, and replaces this one in `recommended`.
export default httpRule(NAME)
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
    "A browser that has never seen a host's HSTS Policy still starts with plain HTTP, typically because a user typed the bare domain. Answering that request with a permanent redirect to https moves the user onto a secure connection, where the Strict-Transport-Security header can then be delivered. Serving content over HTTP instead keeps the user there, where any attacker on the network can read and rewrite the traffic; a temporary redirect (302, 307) moves the user too, but is followed again over HTTP on every visit.",
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
