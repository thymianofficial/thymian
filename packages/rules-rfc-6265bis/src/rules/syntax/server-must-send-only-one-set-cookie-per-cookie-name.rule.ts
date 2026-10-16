import { constant, httpRule, type LiveApiContext } from '@thymian/core';

import { liveHeaderValues } from '../utils/headers.js';
import { violation } from '../utils/results.js';
import { receivedCookie, SET_COOKIE_HEADER } from '../utils/set-cookie.js';

// The cookie-names of a response as a user agent records them: a line it
// ignores, entirely or on receipt, sets no cookie, and the grammar rule
// reports it. Cookie names are
// case-sensitive, so "SID" and "sid" are two cookies.
function repeatedNames(lines: string[]): string[] {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const cookie = receivedCookie(line);
    if (cookie !== undefined) {
      counts.set(cookie.name, (counts.get(cookie.name) ?? 0) + 1);
    }
  }
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([name, count]) => `"${name}" ${count} times`);
}

// `constant(true)` as the candidate filter: `test` picks the requests it
// sends over the described transactions, and a server that sets a cookie
// where the description declares no Set-Cookie is the case a response-side
// candidate would never see.
function checkLive(ctx: LiveApiContext) {
  return ctx.validateHttpTransactions(constant(true), (_req, res, location) => {
    const lines = liveHeaderValues(res.headers, SET_COOKIE_HEADER);
    const repeated = repeatedNames(lines);
    return repeated.length === 0
      ? []
      : [
          violation(
            location,
            `This response sets the cookie ${repeated.join(' and ')}, in the Set-Cookie lines ${lines.map((line) => `"${line}"`).join(', ')}. Servers must not send more than one Set-Cookie header field with the same cookie-name in one response: a user agent processes them in order, so the last one it stores replaces the others.`,
          ),
        ];
  });
}

// No `static`: an API description declares a response's headers as a map
// keyed by name, which cannot hold two field lines of one header (the
// coverage record's `not-representable` cell). Several pinned values of a
// declared Set-Cookie are alternatives, not lines of one response.
export default httpRule(
  'rfc-6265bis/server-must-send-only-one-set-cookie-per-cookie-name',
)
  .severity('error')
  .type('test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.1.1',
  )
  .description(
    'Servers MUST NOT include more than one Set-Cookie header field in the same response with the same cookie-name. (See Section 5.6 for how user agents handle this case.)',
  )
  .summary(
    'Server must not send two Set-Cookie header fields with the same cookie-name in one response.',
  )
  .explanation(
    'Two Set-Cookie lines for one cookie in one response usually mean two layers each setting it: a session middleware and the application, or a login handler that sets the cookie and then clears it. A browser processes the lines in order, and whichever it stores last wins, so what the server meant by the first is lost, and a cookie meant to be set may end up deleted. Set each cookie once per response.',
  )
  .appliesTo('server')
  .rule(checkLive)
  .done();
