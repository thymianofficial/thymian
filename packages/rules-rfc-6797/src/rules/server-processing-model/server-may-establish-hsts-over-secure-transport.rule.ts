import { httpRule } from '@thymian/core';

import { stsPresenceRule } from '../utils/sts-contexts.js';

const { lint, live } = stsPresenceRule(
  'This response over secure transport (https) carries no Strict-Transport-Security header field. RFC 6797 lets a host establish HSTS by returning one; this response does not use it.',
);

// A MAY is checkable at `hint`: the finding is "the protocol offers this
// mechanism and it is not used", which claims no non-conformance.
export default httpRule(
  'rfc-6797/server-may-establish-hsts-over-secure-transport',
)
  .severity('hint')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-7.1')
  .description(
    'Establishing a given host as a Known HSTS Host, in the context of a given UA, MAY be accomplished over HTTP, which is in turn running over secure transport, by correctly returning (per this specification) at least one valid STS header field to the UA. Other mechanisms, such as a client-side pre-loaded Known HSTS Host list, MAY also be used.',
  )
  .summary(
    'Server may establish HSTS by sending Strict-Transport-Security over https.',
  )
  .explanation(
    'Returning a Strict-Transport-Security header over https is how a host tells browsers to use only https from then on. A response without it gives the browser nothing to note. The pre-load list RFC 6797 also mentions is not visible in any exchange. The server-should-send-sts-header-over-secure-transport convention rule asks for the header outright and replaces this hint in the recommended profile.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
