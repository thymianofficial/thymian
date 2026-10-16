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
  'rfc-6265bis/user-agent-must-ignore-attribute-value-over-1024-octets';

// The grammar sets no length limit on a Path, a Max-Age or an extension-av,
// so a line can conform to it and still carry an attribute a user agent
// ignores. Only such a line is this rule's: on a line the grammar rejects —
// a Domain or an Expires that long fails its own production — the grammar
// rule reports what the browser does, this step included, so the defect is
// reported once. A line the user agent ignores entirely sets no cookie, and
// the rule on why reports it.
const check = onConformingLine(({ name }, line) => {
  const oversized = attributesIgnoredAt(line, '5.6/step-6').map(
    ({ cookieAv, reason }) => `${attributeNameOf(cookieAv)}, as ${reason}`,
  );

  return oversized.length === 0
    ? undefined
    : `The Set-Cookie line for the cookie "${name}" carries an attribute a user agent ignores (${citeStep('5.6/step-6')}): ${oversized.join('; ')}. The cookie is stored without it.`;
});

const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, check);

// A user agent following draft-22 must use an algorithm equivalent to
// §5.6's unparsed-attributes algorithm, so the step is a MUST, and exact:
// the attribute value is in the line.
export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.6',
  )
  .description(
    'The user agent MUST use an algorithm equivalent to the following algorithm to parse the unparsed-attributes: [...] 6. If the attribute-value is longer than 1024 octets, ignore the cookie-av string and return to Step 1 of this algorithm.',
  )
  .summary(
    'User agent must ignore a cookie attribute whose value exceeds 1024 octets.',
  )
  .explanation(
    'A browser ignores any cookie attribute whose value is longer than 1024 octets and stores the cookie without it, without a word to the server. The cookie is kept, but not as the server set it: a long Path stops scoping the cookie to that path, and a long Max-Age or extension attribute has no effect. Keep every attribute value short; a path that long is better served by a shorter common prefix.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
