import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRuleFns } from '../utils/sts-contexts.js';
import { findDirectives, maxAgeSeconds } from '../utils/sts-field-value.js';

const NAME = 'rfc-6797/hsts-host-may-assert-include-subdomains';

// An OPTIONAL directive is checkable at `hint`: the finding is that the
// protocol offers the mechanism and the host does not use it, not that the
// host is non-conformant.
const { lint, live } = stsValueRuleFns(
  NAME,
  onConformingValue((directives, fieldValue) => {
    // No policy to extend: without a max-age there is none, and max-age=0
    // deletes it, subdomains included (§6.1.1).
    const maxAge = maxAgeSeconds(directives);
    if (maxAge === undefined || maxAge === 0) {
      return undefined;
    }

    return findDirectives(directives, 'includesubdomains').length > 0
      ? undefined
      : `The Strict-Transport-Security value "${fieldValue}" does not assert includeSubDomains, so the HSTS Policy does not extend to subdomains of this host.`;
  }),
);

export default httpRule(NAME)
  .severity('hint')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1.2')
  .description(
    'The OPTIONAL "includeSubDomains" directive is a valueless directive which, if present (i.e., it is "asserted"), signals the UA that the HSTS Policy applies to this HSTS Host as well as any subdomains of the host\'s domain name.',
  )
  .summary(
    'HSTS Host may assert includeSubDomains to extend its policy to subdomains.',
  )
  .explanation(
    'Without includeSubDomains, a browser still talks plain HTTP to every subdomain it has not received a policy from, and an attacker who can answer for such a subdomain can set cookies for the parent domain. Asserting it closes that gap, but only once every subdomain is actually served over https — whether that holds is something only the operator knows, which is why RFC 6797 makes the directive OPTIONAL and this rule only hints at it.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the value
  // sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
