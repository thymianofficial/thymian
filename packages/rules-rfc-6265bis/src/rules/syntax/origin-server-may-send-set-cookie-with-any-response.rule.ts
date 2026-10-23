import { type ApiContext, httpRule, not, statusCodeRange } from '@thymian/core';

import { carriesHeader } from '../utils/headers.js';
import { violation } from '../utils/results.js';
import { SET_COOKIE_HEADER } from '../utils/set-cookie.js';

// A MAY is checkable at `hint`: the finding is "the protocol offers this
// mechanism and this response does not use it", which claims no
// non-conformance. Presence is a header name, which the common interface
// carries on its own, so one function serves all three contexts: the
// declared headers in `static`, the headers sent in `test` and `analytics`.
// A 1xx response is left out, because a user agent may ignore a Set-Cookie
// it carries (§3, §5.6), and the rule on that step says so.
function checkPresence(ctx: ApiContext) {
  return ctx.validateCommonHttpTransactions(
    not(statusCodeRange(100, 199)),
    (_req, res, location) =>
      carriesHeader(res, SET_COOKIE_HEADER)
        ? []
        : [
            violation(
              location,
              'This response carries no Set-Cookie header field. Draft-22 lets an origin server send Set-Cookie with any response; this one does not use it.',
            ),
          ],
  );
}

export default httpRule(
  'rfc-6265bis/origin-server-may-send-set-cookie-with-any-response',
)
  .severity('hint')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-3',
  )
  .description(
    'Origin servers MAY send a Set-Cookie response header field with any response. An origin server can include multiple Set-Cookie header fields in a single response.',
  )
  .summary('Origin server may send Set-Cookie with any response.')
  .explanation(
    'A server can set, refresh or delete a cookie on any response it sends, whatever its status code: a browser processes Set-Cookie on a redirect or an error response just as on a success. This rule only points out the responses that set none, which is the right choice for most of them; it is a hint, not a finding of non-conformance.',
  )
  .appliesTo('server')
  .rule(checkPresence)
  .done();
