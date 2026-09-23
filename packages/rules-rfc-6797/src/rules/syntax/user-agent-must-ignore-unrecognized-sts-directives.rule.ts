import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRule } from '../utils/sts-contexts.js';

const NAME = 'rfc-6797/user-agent-must-ignore-unrecognized-sts-directives';

const DEFINED_DIRECTIVES = new Set(['max-age', 'includesubdomains']);

// `preload` is ignored by a user agent implementing only RFC 6797 too, but it
// is sent on purpose — for the browser pre-load lists — and
// `server-should-send-sts-preload-directive` is the rule that speaks to it.
const DELIBERATE_DIRECTIVES = new Set(['preload']);

const { lint, live } = stsValueRule(
  NAME,
  onConformingValue((directives, fieldValue) => {
    const unrecognized = [
      ...new Set(
        directives
          .map(({ name }) => name)
          .filter(
            (name) =>
              !DEFINED_DIRECTIVES.has(name) && !DELIBERATE_DIRECTIVES.has(name),
          ),
      ),
    ];

    return unrecognized.length === 0
      ? undefined
      : `The Strict-Transport-Security value "${fieldValue}" carries ${unrecognized.map((name) => `"${name}"`).join(', ')}, which RFC 6797 does not define; a UA implementing RFC 6797 ignores it.`;
  }),
);

export default httpRule(NAME)
  .severity('hint')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1')
  .description(
    'If an STS header field contains directive(s) not recognized by the UA, the UA MUST ignore the unrecognized directives, and if the STS header field otherwise satisfies the above requirements (1 through 4), the UA MUST process the recognized directives.',
  )
  .summary(
    'A Strict-Transport-Security directive RFC 6797 does not define is ignored by user agents.',
  )
  .explanation(
    'RFC 6797 defines two directives, max-age and includeSubDomains, and requires user agents to skip any other — so a misspelled "includeSubDomain" silently leaves every subdomain unprotected. This rule points out a directive a user agent implementing only RFC 6797 will skip. It is a hint and a heuristic: a directive defined after RFC 6797, or one some user agents recognise, is not a mistake. "preload" is left to its own rule.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
