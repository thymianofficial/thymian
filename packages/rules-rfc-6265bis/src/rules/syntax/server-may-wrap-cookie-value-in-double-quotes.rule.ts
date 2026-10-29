import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import { readAsProducer, SET_COOKIE_HEADER } from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/server-may-wrap-cookie-value-in-double-quotes';

// A MAY is checkable at `hint`: the finding is "the grammar offers this
// form and this cookie does not use it", which claims no non-conformance.
// The permission is the grammar's own alternative, so the rule reads the
// producer reading, and a line the grammar rejects — a DQUOTE no DQUOTE
// closes among them — is the grammar rule's alone.
const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, (line) => {
  const reading = readAsProducer(line);
  return !reading.conforms || reading.value.startsWith('"')
    ? undefined
    : `The cookie-value of the Set-Cookie line "${line}" is not wrapped in DQUOTE characters. Draft-22 lets a server wrap it; this cookie does not use that form.`;
});

export default httpRule(NAME)
  .severity('hint')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.1.1',
  )
  .description(
    'Per the grammar above, the cookie-value MAY be wrapped in DQUOTE characters. Note that in this case, the initial and trailing DQUOTE characters are not stripped. They are part of the cookie-value, and will be included in Cookie header fields sent to the server.',
  )
  .summary('Server may wrap a cookie-value in double quotes.')
  .explanation(
    'The grammar allows a cookie-value with or without surrounding double quotes. A browser does not strip them: the quotes are part of the value, and the browser sends them back in the Cookie header, so a server that wraps a value must expect the quotes when it reads the value again. Either form conforms; this rule is a hint, not a finding of non-conformance.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
