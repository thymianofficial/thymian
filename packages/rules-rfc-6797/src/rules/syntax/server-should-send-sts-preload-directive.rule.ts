import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRuleFns } from '../utils/sts-contexts.js';
import { findDirectives, maxAgeSeconds } from '../utils/sts-field-value.js';

const NAME = 'rfc-6797/server-should-send-sts-preload-directive';

// Without a max-age there is no policy to preload, and max-age=0 withdraws
// it: asking for preload there would be contradictory.
const { lint, live } = stsValueRuleFns(
  NAME,
  onConformingValue((directives, fieldValue) => {
    const maxAge = maxAgeSeconds(directives);
    if (maxAge === undefined || maxAge === 0) {
      return undefined;
    }
    return findDirectives(directives, 'preload').length > 0
      ? undefined
      : `The Strict-Transport-Security value "${fieldValue}" does not carry preload, so the host cannot be submitted to the browser pre-load lists and stays unprotected on a browser's first visit.`;
  }),
);

// A convention rule, and the weakest-sourced one in the package: the string
// "preload" appears nowhere in RFC 6797. It rides inside RFC 6797's header,
// where §6.1 tells UAs to ignore directives they do not recognise. It covers
// no unit, ships `off`, and the `recommended` profile turns it on.
export default httpRule(NAME)
  .severity('off')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1')
  .description(
    'A Strict-Transport-Security header field should carry the preload directive. RFC 6797 does not define preload; this is a convention.',
  )
  .summary(
    'Server should send the preload directive in Strict-Transport-Security.',
  )
  .explanation(
    "RFC 6797 never mentions preload, which is the opt-in the browser vendors read before adding a host to the pre-load lists their browsers ship with, and the recommended profile only hints at it because a listed host is protected even on its very first visit, yet leaving a list again takes months, so the commitment is the operator's to make.",
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the value
  // sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
