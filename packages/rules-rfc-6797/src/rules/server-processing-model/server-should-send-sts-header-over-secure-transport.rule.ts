import { httpRule } from '@thymian/core';

import { stsPresenceRule } from '../utils/sts-contexts.js';

const { lint, live } = stsPresenceRule(
  'This response over secure transport (https) carries no Strict-Transport-Security header field, so it gives the browser no HSTS Policy to note or refresh.',
);

// A convention rule. RFC 6797 permits establishing HSTS by returning the
// header (§7.1, a MAY — checked at `hint` by
// `server-may-establish-hsts-over-secure-transport`) and asks it of every
// response only from a host that has already chosen to be an HSTS Host (a
// SHOULD whose condition no single response shows). Requiring it
// unconditionally is the convention: exact in every context, shipped `off`,
// turned on by the `recommended` profile in the hint's place.
export default httpRule(
  'rfc-6797/server-should-send-sts-header-over-secure-transport',
)
  .severity('off')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.1')
  .description(
    'A server should include a Strict-Transport-Security header field in every response over secure transport. RFC 6797 does not require it; this is a convention.',
  )
  .summary(
    'Server should send Strict-Transport-Security in every response over https.',
  )
  .explanation(
    'RFC 6797 only permits a host to establish HSTS by sending this header and asks it of every response only once the host has chosen to be an HSTS Host, and the recommended profile requires it outright because a browser learns the policy from no other source, so without it every first visit and every visit after the policy lapses can be downgraded to plain HTTP.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
