import {
  constant,
  httpRule,
  type LintContext,
  type LiveApiContext,
  responseHeader,
  type RuleFnResult,
  type RuleViolationLocation,
} from '@thymian/core';

import {
  describedTransaction,
  liveHeaderValues,
  pinnedHeaderValues,
} from '../utils/headers.js';
import { ruleSkip, violation } from '../utils/results.js';
import {
  octets,
  parseCookieDate,
  type ReceivedCookie,
  receivedCookie,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/server-should-avoid-large-cookies';

// Both numbers are draft-22's own: §4.2.1 names 8192 octets as the default
// header field limit of many popular servers, and §6.1 asks a browser to keep
// at least 50 cookies per domain. Neither is the limit of the server at hand,
// which no message shows: the rule is heuristic in every context.
const HEADER_FIELD_LIMIT = 8192;
const COOKIES_PER_DOMAIN = 50;

// A cookie as §5.8.3 step 6 serializes it into the cookie-string: the name,
// "=" and the value, or the value alone for an empty name.
function cookiePair({ name, value }: ReceivedCookie): string {
  return name === '' ? value : `${name}=${value}`;
}

// A line that removes its cookie takes it out of the store. The last Max-Age
// wins over any Expires, and the last Expires over an earlier one (§5.7 step
// 6). A Max-Age of zero or less always removes it (§5.6.2 step 7). An Expires
// removes it when it is no later than the Date of the response that carries
// it, never the time of the run: an old recording, or a description's
// example date, would otherwise read as cleared. Without a Date, only an
// Expires at or before the epoch does, the form the grammar rule's message
// names for deleting a cookie.
function removesCookie(
  { attributes }: ReceivedCookie,
  responseDate: Date | undefined,
): boolean {
  const maxAge = attributes
    .filter((attribute) => attribute.name === 'Max-Age')
    .at(-1);
  if (maxAge !== undefined) {
    return maxAge.value <= 0;
  }
  const expires = attributes
    .filter((attribute) => attribute.name === 'Expires')
    .at(-1);
  return (
    expires !== undefined &&
    expires.value.getTime() <= (responseDate?.getTime() ?? 0)
  );
}

// The Date of a response, read as a user agent reads a cookie-date.
function dateOf(values: string[] | undefined): Date | undefined {
  const [value] = values ?? [];
  return value === undefined ? undefined : parseCookieDate(value);
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

// The cookies one server sets, per host, as a browser's store collects them
// over every response it is sent: the final cookie-string §4.2.1 speaks of is
// what all of them add up to, not what one response sets. Heuristic on
// purpose:
//
// - a cookie is keyed by its name: a later response that refreshes it takes
//   no second slot, and one set with a different Path or Domain is counted
//   once, so the count errs low. In traffic a browser received it holds the
//   value it was set to last, as the store does. In an API description each
//   pinned value is one the server may set, in no order a browser would see,
//   so it holds the largest;
// - a line a browser ignores sets no cookie, and the rule on why reports it:
//   one over 4096 octets, and every line the grammar rule owns;
// - every cookie is assumed sent back with every request to its host, as a
//   cookie of Path "/" and no Domain is;
// - a line that deletes a cookie takes it out of the jar, so a cookie the
//   server set and later cleared no longer counts;
// - recorded traffic mixes many browsers, and all of them fill one store per
//   host: cookies named per client, such as a correlation or nonce cookie
//   with an id in its name, add up past what any one browser holds.
//
// One defect, one violation: a host is reported once, on the response whose
// cookies first take it past either number.
function cookieVolume(
  keep: 'latest' | 'largest',
): (
  location: RuleViolationLocation,
  origin: string,
  lines: string[],
  responseDate: Date | undefined,
) => RuleFnResult[] {
  const hosts = new Map<string, Map<string, number>>();
  const reported = new Set<string>();

  return (location, origin, lines, responseDate) => {
    const host = hostOf(origin);
    if (reported.has(host)) {
      return [];
    }

    const cookies = hosts.get(host) ?? new Map<string, number>();
    hosts.set(host, cookies);
    for (const line of lines) {
      const cookie = receivedCookie(line);
      if (cookie === undefined) {
        continue;
      }
      if (removesCookie(cookie, responseDate)) {
        cookies.delete(cookie.name);
      } else {
        const size = octets(cookiePair(cookie));
        cookies.set(
          cookie.name,
          keep === 'latest'
            ? size
            : Math.max(cookies.get(cookie.name) ?? 0, size),
        );
      }
    }

    const count = cookies.size;
    // cookie-string = cookie-pair *( ";" SP cookie-pair )
    const length =
      [...cookies.values()].reduce((sum, size) => sum + size, 0) +
      2 * Math.max(count - 1, 0);
    if (length <= HEADER_FIELD_LIMIT && count <= COOKIES_PER_DOMAIN) {
      return [];
    }

    reported.add(host);
    const excess = [
      length > HEADER_FIELD_LIMIT
        ? `more than the ${HEADER_FIELD_LIMIT} octets many servers limit a header field to, so requests to the server may fail`
        : undefined,
      count > COOKIES_PER_DOMAIN
        ? `more than the ${COOKIES_PER_DOMAIN} cookies per domain a browser need keep, so a browser may evict some`
        : undefined,
    ].filter((reason): reason is string => reason !== undefined);
    return [
      violation(
        location,
        `With this response, the server has set ${count} cookies for ${host}, which a browser sends back in a Cookie header of ${length} octets: ${excess.join(', and ')}. Servers should use as few and as small cookies as possible.`,
      ),
    ];
  };
}

// The common interface sees header names only, so every context is
// overridden, and not through the shared header contexts, which judge one
// line at a time: this rule keeps a store across transactions. `static` reads the values the description pins for each
// response, every pinned value a cookie the server may set; a Set-Cookie it
// does not pin is a `rule-skip`.
function checkLint(ctx: LintContext) {
  const judgeVolume = cookieVolume('largest');
  return ctx.validateCommonHttpTransactions(
    responseHeader(SET_COOKIE_HEADER),
    (req, _res, location) => {
      const res = describedTransaction(ctx, location)?.thymianRes;
      const lines =
        res === undefined
          ? undefined
          : pinnedHeaderValues(res, SET_COOKIE_HEADER);
      const responseDate =
        res === undefined ? undefined : dateOf(pinnedHeaderValues(res, 'Date'));

      return lines === undefined
        ? [
            ruleSkip(
              location,
              NAME,
              `The API description declares ${SET_COOKIE_HEADER} without pinning its value (const, enum or examples), so the size of the cookie it sets cannot be checked statically.`,
            ),
          ]
        : judgeVolume(location, req.origin, lines, responseDate);
    },
  );
}

// `constant(true)` as the candidate filter: `test` picks the requests it
// sends over the described transactions, and a server that sets cookies
// where its description declares no Set-Cookie is the case a response-side
// candidate would never see.
function checkLive(ctx: LiveApiContext) {
  const judgeVolume = cookieVolume('latest');
  return ctx.validateHttpTransactions(constant(true), (req, res, location) =>
    judgeVolume(
      location,
      req.origin,
      liveHeaderValues(res.headers, SET_COOKIE_HEADER),
      dateOf(liveHeaderValues(res.headers, 'Date')),
    ),
  );
}

// One rule for two units: §4.2.1's cookie-string past the header field limit
// and §6.1's few and small cookies are both the size and number of cookies
// one server sets. `security:dos` beside `security:cookies`: past the header
// field limit, the server refuses every request that carries the cookies,
// which is resource exhaustion the server inflicts on its own users.
export default httpRule(NAME)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:cookies', 'security:dos')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.2.1',
  )
  .description(
    "While Section 5.4 of [HTTP] does not define a length limit for header fields it is likely that the web server's implementation does impose a limit; many popular implementations have default limits of 8192 octets. Servers SHOULD avoid setting a large number of large cookies such that the final cookie-string would exceed their header field limit. Not doing so could result in requests to the server failing. (Section 6.1:) Servers SHOULD use as few and as small cookies as possible to avoid reaching these implementation limits, minimize network bandwidth due to the Cookie header field being included in every request, and to avoid reaching server header field limits (See Section 4.2.1).",
  )
  .summary(
    'Server should set few and small cookies, so that the Cookie header stays within header field limits.',
  )
  .explanation(
    'A browser sends every cookie a server set back in the Cookie header of each request to it. Once those cookies add up past the header field limit of the server or of a proxy in front of it, often 8192 octets, every request is refused, usually with 431 or 400, until the user clears the cookies: the site locks its own users out. Past 50 cookies for one domain, a browser may also start evicting cookies the server still relies on. Keep state on the server and send one small session identifier instead. This rule is a warning, not an error, because the actual limit of the server is not visible, and it counts every cookie of a host as sent with every request. In recorded traffic it also counts the cookies of every client together, so cookies named per client can add up past what one browser holds.',
  )
  .appliesTo('server')
  .overrideStaticRule(checkLint)
  .overrideTest(checkLive)
  .overrideAnalyticsRule(checkLive)
  .done();
