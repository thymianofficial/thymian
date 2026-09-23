import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRule } from '../utils/sts-contexts.js';
import { findDirectives, isDeltaSeconds } from '../utils/sts-field-value.js';

const NAME = 'rfc-6797/hsts-host-may-assert-include-subdomains';

const { lint, live } = stsValueRule(
  NAME,
  onConformingValue((directives, fieldValue) => {
    const maxAge = findDirectives(directives, 'max-age')[0]?.value;
    // max-age=0 deletes the policy, subdomains included (§6.1.1), so there is
    // nothing for includeSubDomains to extend.
    if (!isDeltaSeconds(maxAge) || Number(maxAge) === 0) {
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
    'Without includeSubDomains, a browser still talks plain HTTP to every subdomain it has not received a policy from, and an attacker who can answer for such a subdomain can set cookies for the parent domain. Asserting it closes that gap, but only once every subdomain is actually served over https — whether that holds is something only the operator knows, which is why this is a hint, not a requirement.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
