import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRule } from '../utils/sts-contexts.js';
import { findDirectives, isDeltaSeconds } from '../utils/sts-field-value.js';

const NAME = 'rfc-6797/server-should-send-sts-preload-directive';

const { lint, live } = stsValueRule(
  NAME,
  onConformingValue((directives, fieldValue) => {
    const maxAge = findDirectives(directives, 'max-age')[0]?.value;
    // max-age=0 withdraws the policy; asking for preload there would be
    // contradictory.
    if (!isDeltaSeconds(maxAge) || Number(maxAge) === 0) {
      return undefined;
    }
    return findDirectives(directives, 'preload').length > 0
      ? undefined
      : `The Strict-Transport-Security value "${fieldValue}" does not carry preload, so the host cannot be submitted to the browser pre-load lists and stays unprotected on a browser's first visit.`;
  }),
);

// A convention rule, and the weakest-sourced one in the package: the string
// "preload" appears nowhere in RFC 6797. It rides inside RFC 6797's header,
// where §6.1 tells user agents to ignore directives they do not recognise.
export default httpRule(NAME)
  .severity('off')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1')
  .description(
    'A Strict-Transport-Security header field should carry the preload directive. RFC 6797 does not define preload; this is a convention.',
  )
  .summary('Strict-Transport-Security should carry the preload directive.')
  .explanation(
    "RFC 6797 never mentions preload, which is the opt-in the browser vendors read before adding a host to the pre-load lists their browsers ship with, and the recommended profile only hints at it because a listed host is protected even on its very first visit, yet leaving a list again takes months, so the commitment is the operator's to make.",
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
