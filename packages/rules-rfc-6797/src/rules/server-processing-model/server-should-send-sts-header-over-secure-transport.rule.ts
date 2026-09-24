import { httpRule } from '@thymian/core';

import { stsPresenceRuleFn } from '../utils/sts-contexts.js';

const checkPresence = stsPresenceRuleFn(
  'This response over secure transport (https) carries no Strict-Transport-Security header field, so it gives the browser no HSTS Policy to note or refresh.',
);

// A convention rule, the exact twin of 7.1's conditional SHOULD. RFC 6797
// permits establishing HSTS by returning the header (a MAY, checked at `hint`
// by `server-may-establish-hsts-over-secure-transport`) and asks it of every
// response only from a host that has already chosen to be an HSTS Host,
// which no single response shows. Asking it of every server drops the
// condition and makes the check exact, so this one ships `off`, covers no
// unit, and the `recommended` profile turns it on in the hint's place.
export default httpRule(
  'rfc-6797/server-should-send-sts-header-over-secure-transport',
)
  .severity('off')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.1')
  .description(
    'A server should include a Strict-Transport-Security header field in every response over secure transport. RFC 6797 does not require it of every server; this is a convention.',
  )
  .summary(
    'Server should send Strict-Transport-Security in every response over https.',
  )
  .explanation(
    "RFC 6797 only permits a host to establish HSTS by sending this header and asks it of every response only from a host that has already chosen to be an HSTS Host, and the recommended profile requires it of every server because, outside the browsers' pre-load lists, the header is the only way a browser learns the policy, so a response without it leaves every first visit, and every visit after the policy lapses, open to a downgrade to plain HTTP.",
  )
  .appliesTo('server')
  .rule(checkPresence)
  .done();
