import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRuleFns } from '../utils/sts-contexts.js';
import { maxAgeSeconds } from '../utils/sts-field-value.js';

const NAME = 'rfc-6797/server-should-send-sts-max-age-of-at-least-one-year';

const ONE_YEAR = 31_536_000;

// A missing or malformed max-age is another rule's defect. max-age=0 is below
// the floor too: it withdraws the policy, which is what the floor argues
// against — unlike the includeSubDomains and preload rules, which stay silent
// on it because there is nothing left to extend or preload.
const { lint, live } = stsValueRuleFns(
  NAME,
  onConformingValue((directives, fieldValue) => {
    const maxAge = maxAgeSeconds(directives);
    return maxAge !== undefined && maxAge < ONE_YEAR
      ? `The Strict-Transport-Security value "${fieldValue}" sets max-age=${maxAge}, below one year (${ONE_YEAR} seconds).`
      : undefined;
  }),
);

// A convention rule: RFC 6797 sets no floor for max-age (§11.2, which is
// non-normative, even suggests a default of zero), so it covers no unit, ships
// `off`, and the `recommended` profile turns it on.
export default httpRule(NAME)
  .severity('off')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1.1')
  .description(
    'A Strict-Transport-Security max-age should be at least one year (31536000 seconds). RFC 6797 sets no minimum; this is a convention.',
  )
  .summary(
    'Server should send a Strict-Transport-Security max-age of at least one year.',
  )
  .explanation(
    "RFC 6797 requires a max-age but sets no minimum, and the recommended profile warns below one year because a short policy lapses between a user's visits — each lapse reopens the first-request downgrade window HSTS exists to close — and one year is the floor the browser pre-load lists require.",
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the value
  // sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
