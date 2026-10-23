import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  attributeNameOf,
  attributesIgnoredAt,
  citeStep,
  onConformingLine,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME =
  'rfc-6265bis/user-agent-must-ignore-unrecognized-cookie-attributes';

// An extension-av conforms to the grammar, so a conforming line can carry
// an attribute a draft-22 user agent does not recognize. Only such a line is
// this rule's: on a line the grammar rejects, the grammar rule reports what
// the browser does, this step included, so the defect is reported once. A
// value past 1024 octets is ignored first, by the step its own rule reports.
const check = onConformingLine(({ name }, line) => {
  const unrecognized = attributesIgnoredAt(line, '5.6/step-7').map(
    ({ cookieAv }) => `"${attributeNameOf(cookieAv)}"`,
  );

  return unrecognized.length === 0
    ? undefined
    : `The Set-Cookie line for the cookie "${name}" carries the attribute ${unrecognized.join(', ')}, which draft-22 does not define: a user agent that recognizes only draft-22's attributes ignores it (${citeStep('5.6/step-7')}).`;
});

const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, check);

// A hint, and heuristic in every context: an attribute another
// specification defines, such as Partitioned, or one some browsers
// recognize, such as Priority, is kept by the user agents that know it, and
// a misspelled attribute looks the same as either. What the finding claims
// is only that a draft-22 user agent drops it.
export default httpRule(NAME)
  .severity('hint')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.6',
  )
  .description(
    'The user agent MUST use an algorithm equivalent to the following algorithm to parse the unparsed-attributes: [...] 7. Process the attribute-name and attribute-value according to the requirements in the following subsections. (Notice that attributes with unrecognized attribute-names are ignored.)',
  )
  .summary('User agent must ignore a cookie attribute it does not recognize.')
  .explanation(
    'A browser ignores every cookie attribute it does not recognize and stores the cookie without it. Draft-22 defines Expires, Max-Age, Domain, Path, Secure, HttpOnly and SameSite; anything else depends on the browser. That is intended for an attribute another specification defines, such as Partitioned, but a misspelled attribute, such as "HttpOnyl" or "Same-Site", is dropped the same way, and the protection it was meant to add is silently missing. This rule is a hint: check that every attribute it names is one you meant, and that the browsers you serve support it.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
