import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRuleFns } from '../utils/sts-contexts.js';
import { findDirectives } from '../utils/sts-field-value.js';

const NAME = 'rfc-6797/hsts-host-must-send-max-age-directive';

const { lint, live } = stsValueRuleFns(
  NAME,
  onConformingValue((directives, fieldValue) =>
    findDirectives(directives, 'max-age').length > 0
      ? undefined
      : `The Strict-Transport-Security value "${fieldValue}" has no max-age directive, which is REQUIRED; a UA ignores an STS header field without one.`,
  ),
);

export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1.1')
  .description(
    'The REQUIRED "max-age" directive specifies the number of seconds, after the reception of the STS header field, during which the UA regards the host (from whom the message was received) as a Known HSTS Host.',
  )
  .summary(
    'HSTS Host must send a max-age directive in every Strict-Transport-Security value.',
  )
  .explanation(
    'max-age is what tells the browser how long to remember the policy; without it there is no policy to remember. A header such as "Strict-Transport-Security: includeSubDomains" is not a shorter policy but no policy at all, because a browser ignores a header that lacks a required directive.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the value
  // sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
