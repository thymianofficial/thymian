import { httpRule } from '@thymian/core';

import { cookieExchangeRuleFns } from '../utils/exchange-contexts.js';
import {
  type CookiePrefix,
  hasCookiePrefix,
  type ReceivedCookie,
  requestedLifetime,
} from '../utils/set-cookie.js';
import {
  canonicalHost,
  type CookieExchange,
  hasEnforcedPrefix,
  ignoredCrossSite,
  ignoredInStorage,
  isHostLocked,
  isSecureOnly,
  publicSuffixDomain,
} from '../utils/storage-model.js';

const NAME = 'rfc-6265bis/server-should-use-cookie-name-prefixes';

// Which cookies warrant a prefix is application knowledge, so the rule is
// heuristic everywhere: it flags only a cookie that already meets a prefix's
// requirements and does not carry it, where renaming it costs nothing but
// lets every browser enforce what the server already does. `__Host-` where
// the cookie is host-locked, `__Secure-` where it is only Secure.
//
// A cookie whose prefix is miscapitalized, `__secure-SID`, gets the
// prefix's requirements from a browser, which matches it case-insensitively
// (§5.4), but not from a server: §4.1.3.1 and §4.1.3.2 define the prefix
// case-sensitively, so code that reads it as the draft spells it does not
// recognize the cookie. It is nudged to the draft's spelling.
//
// Not flagged: a cookie without Secure, which meets neither prefix; a line
// that removes its cookie, whose name must stay the one it removes; and a
// cookie a browser ignores at a step of §5.7, which that step's rule
// reports, the public-suffix and cross-site ones included.
const PREFIXES: CookiePrefix[] = ['__Secure-', '__Host-'];

// The prefix a name carries in a capitalization other than the draft's.
function miscapitalizedPrefix(name: string): CookiePrefix | undefined {
  return PREFIXES.find(
    (prefix) => hasCookiePrefix(name, prefix) && !name.startsWith(prefix),
  );
}

function isPublicSuffixCookie(
  cookie: ReceivedCookie,
  { origin }: CookieExchange,
): boolean {
  const host = canonicalHost(origin);
  return host !== undefined && publicSuffixDomain(cookie, host) !== undefined;
}

const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  (cookie, exchange) => {
    const lifetime = requestedLifetime(cookie, Date.now());
    if (
      (lifetime !== undefined && lifetime.seconds <= 0) ||
      ignoredInStorage(cookie, exchange) !== undefined ||
      isPublicSuffixCookie(cookie, exchange) ||
      ignoredCrossSite(cookie, exchange)
    ) {
      return undefined;
    }

    const miscapitalized = miscapitalizedPrefix(cookie.name);
    if (miscapitalized !== undefined) {
      const named = `${miscapitalized}${cookie.name.slice(miscapitalized.length)}`;
      return `The cookie "${cookie.name}" starts with the ${miscapitalized} prefix in another capitalization. A browser matches the prefix case-insensitively and enforces its requirements, but draft-22 defines it case-sensitively for servers, so code that checks for ${miscapitalized} as the draft spells it does not recognize the cookie. Name it ${named}.`;
    }
    if (hasEnforcedPrefix(cookie) || !isSecureOnly(cookie)) {
      return undefined;
    }

    const [prefix, requirements] = isHostLocked(cookie, exchange)
      ? ['__Host-', 'Secure, no Domain and Path=/']
      : ['__Secure-', 'Secure'];
    return `The cookie "${cookie.name}" meets the requirements of the ${prefix} prefix (${requirements}), but its name does not carry it. Named ${prefix}${cookie.name}, a browser would refuse any cookie of that name that does not meet them, whoever sets it.`;
  },
);

export default httpRule(NAME)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.1.3',
  )
  .description(
    "Section 8.5 and Section 8.6 of this document spell out some of the drawbacks of cookies' historical implementation. In particular, it is impossible for a server to have confidence that a given cookie was set with a particular set of attributes. In order to provide such confidence in a backwards-compatible way, two common sets of requirements can be inferred from the first few characters of the cookie's name. [...] To maximize compatibility with user agents servers SHOULD use prefixes as described below.",
  )
  .summary(
    'Server should name a cookie with the __Host- or __Secure- prefix it already qualifies for.',
  )
  .explanation(
    'A server cannot tell from a Cookie header how a cookie was set: a cookie it set with Secure looks the same as one an attacker set over plain http, or from a sibling subdomain, with the same name. A name that starts with __Secure- or __Host- makes the browser enforce the attributes for it: it refuses a __Secure- cookie without Secure and a __Host- cookie that is not Secure, host-only and on Path=/. A cookie that already has those attributes loses nothing by the prefix, and gains protection against being overwritten or shadowed. This rule is a warning on a heuristic: which cookies need that protection only the application knows.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
