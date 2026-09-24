import { httpRule } from '@thymian/core';

import { onConformingValue, stsValueRuleFns } from '../utils/sts-contexts.js';

const NAME = 'rfc-6797/hsts-host-must-not-repeat-sts-directives';

const { lint, live } = stsValueRuleFns(
  NAME,
  onConformingValue((directives, fieldValue) => {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const { name } of directives) {
      if (seen.has(name)) {
        repeated.add(name);
      }
      seen.add(name);
    }

    return repeated.size === 0
      ? undefined
      : `The Strict-Transport-Security value "${fieldValue}" repeats the directive(s) ${[...repeated].map((name) => `"${name}"`).join(', ')}. All directives MUST appear only once, and a UA ignores an STS header field that repeats one.`;
  }),
);

export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:transport')
  .url('https://www.rfc-editor.org/rfc/rfc6797.html#section-6.1')
  .description(
    'All directives MUST appear only once in an STS header field. Directives are either optional or required, as stipulated in their definitions.',
  )
  .summary(
    'HSTS Host must not repeat a directive in a Strict-Transport-Security value.',
  )
  .explanation(
    'A repeated directive — two max-age values, say, often the result of two layers of configuration each adding their own — makes the header non-conformant, and a browser ignores a non-conformant Strict-Transport-Security header entirely. Directive names compare case-insensitively, so "max-age" and "Max-Age" count as the same directive.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the value
  // sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
