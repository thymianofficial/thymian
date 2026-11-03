import {
  and,
  type ApiContext,
  httpRule,
  responseHeader,
  statusCodeRange,
} from '@thymian/core';

import { violation } from '../utils/results.js';
import { SET_COOKIE_HEADER } from '../utils/set-cookie.js';

// A MAY is checkable at `hint`: the finding is that a user agent is allowed
// to drop this cookie, which claims no non-conformance of the server.
// Presence on a status code is a header name, which the common interface
// carries on its own.
//
// `static` only: an API description can declare Set-Cookie on a 1xx
// response, but core does not capture a 1xx interim response as a
// transaction of its own, so neither `test` nor `analytics` sees one.
function checkInterimResponses(ctx: ApiContext) {
  return ctx.validateCommonHttpTransactions(
    and(statusCodeRange(100, 199), responseHeader(SET_COOKIE_HEADER)),
    (_req, res, location) => [
      violation(
        location,
        `This ${res.statusCode} response declares a Set-Cookie header field. A user agent may ignore Set-Cookie on a 1xx response entirely (§5.3, §5.6, §5.7 step 1), so the cookie may never be set; set it on the final response instead.`,
      ),
    ],
  );
}

// One rule for two units: §5.6's paragraph lets a user agent ignore the
// field, §5.7 step 1 the cookie received from it, both by §5.3's
// permission.
export default httpRule(
  'rfc-6265bis/user-agent-may-ignore-set-cookie-in-1xx-response',
)
  .severity('hint')
  .type('static')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.6',
  )
  .description(
    'When a user agent receives a Set-Cookie header field in an HTTP response, the user agent MAY ignore the Set-Cookie header field in its entirety (see Section 5.3). (Section 5.3:) User agents MAY ignore Set-Cookie header fields contained in responses with 100-level status codes or based on its cookie policy (see Section 7.2). (Section 5.7, step 1:) A user agent MAY ignore a received cookie in its entirety. See Section 5.3.',
  )
  .summary('User agent may ignore Set-Cookie on a 1xx response.')
  .explanation(
    'A 1xx response, such as 103 Early Hints, is interim: the final response follows it. Browsers may ignore a Set-Cookie header field on an interim response entirely, so a cookie set there may never be stored. Set every cookie on the final response. This rule is a hint: a browser is allowed to drop the cookie, not required to.',
  )
  .appliesTo('server')
  .rule(checkInterimResponses)
  .done();
