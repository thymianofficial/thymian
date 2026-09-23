import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRule } from '../utils/sts-contexts.js';
import { findDirectives } from '../utils/sts-field-value.js';

const NAME = 'rfc-6797/hsts-host-must-send-include-subdomains-without-value';

const { lint, live } = stsValueRule(
  NAME,
  onConformingValue((directives, fieldValue) =>
    findDirectives(directives, 'includesubdomains').some(
      ({ value }) => value !== undefined,
    )
      ? `The Strict-Transport-Security value "${fieldValue}" gives includeSubDomains a value, but it is a valueless directive; a UA ignores an STS header field that does not conform to the syntax.`
      : undefined,
  ),
);

export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1.2')
  .description(
    'The OPTIONAL "includeSubDomains" directive is a valueless directive which, if present (i.e., it is "asserted"), signals the UA that the HSTS Policy applies to this HSTS Host as well as any subdomains of the host\'s domain name.',
  )
  .summary('HSTS Host must send includeSubDomains without a value.')
  .explanation(
    'includeSubDomains is asserted by its presence alone. Writing "includeSubDomains=true" looks harmless but makes the header non-conformant, so a browser ignores it entirely — the opposite of the intended stronger policy: not only are subdomains left out, the host itself is no longer protected.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
