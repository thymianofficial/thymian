// §5.7, the storage model: what a user agent does with a cookie it received,
// given the request it received the cookie from. The user agent's reading of
// the line (§5.6) gives the cookie; this module gives the fields §5.7 derives
// from it and the steps at which the user agent ignores it for what one
// exchange shows — the request host, the request's scheme and path, and the
// cookie's own attributes.
//
// The algorithm aborts at the first step that ignores the cookie, so a cookie
// is ignored once, at one step. The rules on those steps follow it: each
// speaks only where its step is the one that ignores the cookie, so one
// dropped cookie is one violation. A cookie whose `Secure` is missing and
// that asks for `SameSite=None` and carries a `__Secure-` name is ignored at
// step 19, and the prefix rule is silent on it.

import { getHeader, type HttpRequest } from '@thymian/core';

import {
  hasCookiePrefix,
  type ReceivedCookie,
  removesCookie,
} from './set-cookie.js';

// The request a cookie was received from, as a rule can see it in each
// context: the described origin and path in `static` and `test`, the
// recorded ones in `analytics`. `headers` are the request's field lines,
// sent or recorded; `static` has none.
//
// `transportJudged` is false where the origin may be Thymian's server URL
// fallback rather than the API's (see `transport.ts`): the request host and
// scheme are then unknown, and the steps on them cannot be decided.
export type CookieExchange = {
  origin: string;
  path: string;
  headers: NonNullable<HttpRequest['headers']>;
  transportJudged: boolean;
};

// §5.1.2: the canonicalized request-host — lower case, IDNA-encoded, as the
// URL parser yields it. `undefined` for an origin that is no URL.
export function canonicalHost(origin: string): string | undefined {
  try {
    return new URL(origin).hostname;
  } catch {
    return undefined;
  }
}

function isIpAddress(host: string): boolean {
  return host.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

// §5.1.3. Both inputs are canonicalized: the parser lowercases a Domain.
export function domainMatches(host: string, domain: string): boolean {
  return host === domain || (host.endsWith(`.${domain}`) && !isIpAddress(host));
}

// "A secure connection, as defined by the user agent": every browser treats
// https as one. Nothing else is assumed to be, not even a loopback host some
// browsers also trust, so a recorded http://localhost is judged like any
// other plain-http origin.
export function isSecureConnection(origin: string): boolean {
  try {
    return new URL(origin).protocol === 'https:';
  } catch {
    return false;
  }
}

// §5.7 step 7: the value of the last Domain attribute, or the empty string.
// The user-agent reading has already dropped a value over 1024 octets
// (§5.6 step 6) and a leading ".".
export function domainAttribute({ attributes }: ReceivedCookie): string {
  const domain = attributes
    .filter((attribute) => attribute.name === 'Domain')
    .at(-1);
  return domain?.value ?? '';
}

// §5.1.4: the default-path of a request path.
function defaultPath(path: string): string {
  if (!path.startsWith('/') || path.indexOf('/', 1) === -1) {
    return '/';
  }
  return path.slice(0, path.lastIndexOf('/'));
}

// §5.7 step 11, and whether the cookie-attribute-list holds a Path at all,
// which step 21 asks for beside the path itself. A Path that does not start
// with "/" was recorded as the default-path (§5.6.4).
function cookiePath(
  { attributes }: ReceivedCookie,
  { path }: CookieExchange,
): { path: string; fromAttribute: boolean } {
  const attribute = attributes
    .filter((candidate) => candidate.name === 'Path')
    .at(-1);
  return {
    path: attribute?.value ?? defaultPath(path),
    fromAttribute: attribute !== undefined,
  };
}

// §5.7 step 12.
export function isSecureOnly({ attributes }: ReceivedCookie): boolean {
  return attributes.some((attribute) => attribute.name === 'Secure');
}

// §5.7 step 14.
export function isHttpOnly({ attributes }: ReceivedCookie): boolean {
  return attributes.some((attribute) => attribute.name === 'HttpOnly');
}

// §5.7 step 17: the last SameSite attribute's enforcement, provided one of
// them names Strict, Lax or None; "Default" otherwise.
export function sameSiteFlag({
  attributes,
}: ReceivedCookie): 'Default' | 'None' | 'Strict' | 'Lax' {
  const sameSite = attributes.filter(
    (attribute) => attribute.name === 'SameSite',
  );
  return sameSite.some((attribute) => attribute.value !== 'Default')
    ? (sameSite.at(-1)?.value ?? 'Default')
    : 'Default';
}

// The requirements of a `__Host-` cookie that this one fails (§5.7 step 21),
// in the step's order; none for a host-locked cookie. Host-only is a cookie
// without a Domain (step 10); the public-suffix step's clearing of a Domain
// identical to the request host is left out, as no rule on it is exact.
export function hostPrefixFailures(
  cookie: ReceivedCookie,
  exchange: CookieExchange,
): string[] {
  const { path, fromAttribute } = cookiePath(cookie, exchange);
  const domain = domainAttribute(cookie);
  return [
    isSecureOnly(cookie) ? undefined : 'it has no Secure attribute',
    domain === ''
      ? undefined
      : `it has a Domain attribute (Domain=${domain}), so it is not host-only`,
    !fromAttribute
      ? 'it has no Path attribute'
      : path === '/'
        ? undefined
        : `its path is ${path}, not /`,
  ].filter((failure): failure is string => failure !== undefined);
}

// Whether a cookie meets every requirement of the `__Host-` prefix.
export function isHostLocked(
  cookie: ReceivedCookie,
  exchange: CookieExchange,
): boolean {
  return hostPrefixFailures(cookie, exchange).length === 0;
}

// The prefixes a user agent enforces (§5.7 steps 20 and 21), matched
// case-insensitively.
export function hasEnforcedPrefix({ name }: ReceivedCookie): boolean {
  return hasCookiePrefix(name, '__Secure-') || hasCookiePrefix(name, '__Host-');
}

// §5.7 step 9, as far as Thymian can tell without a public suffix list: a
// single-label Domain, such as "com", is a public suffix under any list, by
// its implicit "*" rule, and a multi-label suffix such as "co.uk" is missed.
// A browser that rejects public suffixes ignores the cookie unless the
// Domain is the request host itself, which makes it host-only; a Domain the
// host does not domain-match is step 10's. `undefined` where the step does
// not ignore the cookie.
export function publicSuffixDomain(
  cookie: ReceivedCookie,
  host: string,
): string | undefined {
  const domain = domainAttribute(cookie);
  return domain === '' ||
    domain.includes('.') ||
    host === domain ||
    !domainMatches(host, domain)
    ? undefined
    : domain;
}

// The steps of §5.7 at which a user agent ignores a cookie for what one
// exchange shows, exactly. Steps 9 and 18 are heuristic, so they never stand
// in front of these: their rules defer to an exact step that also ignores
// the cookie, although the draft puts them earlier.
export type StorageStep =
  '5.7/step-10' | '5.7/step-13' | '5.7/step-19' | '5.7/step-20' | '5.7/step-21';

// The first of those steps that ignores the cookie, and why; `undefined` if
// none does. Where the transport is not judged, steps 10 and 13 are passed
// over: the request host and scheme may be Thymian's fallback, so a later
// step is still judged on the cookie's own attributes.
export function ignoredInStorage(
  cookie: ReceivedCookie,
  exchange: CookieExchange,
): { step: StorageStep; reason: string } | undefined {
  const host = canonicalHost(exchange.origin);
  const domain = domainAttribute(cookie);

  if (
    exchange.transportJudged &&
    host !== undefined &&
    domain !== '' &&
    !domainMatches(host, domain)
  ) {
    return {
      step: '5.7/step-10',
      reason: `the request host ${host} does not domain-match its Domain attribute, ${domain}`,
    };
  }
  if (
    exchange.transportJudged &&
    host !== undefined &&
    isSecureOnly(cookie) &&
    !isSecureConnection(exchange.origin)
  ) {
    return {
      step: '5.7/step-13',
      reason:
        'it has the Secure attribute and was received over a connection that is not https',
    };
  }
  if (sameSiteFlag(cookie) === 'None' && !isSecureOnly(cookie)) {
    return {
      step: '5.7/step-19',
      reason: 'it asks for SameSite=None without the Secure attribute',
    };
  }
  if (hasCookiePrefix(cookie.name, '__Secure-') && !isSecureOnly(cookie)) {
    return {
      step: '5.7/step-20',
      reason:
        'its name starts with the __Secure- prefix, matched case-insensitively, and it has no Secure attribute',
    };
  }
  if (hasCookiePrefix(cookie.name, '__Host-')) {
    const failures = hostPrefixFailures(cookie, exchange);
    if (failures.length > 0) {
      return {
        step: '5.7/step-21',
        reason: `its name starts with the __Host- prefix, matched case-insensitively, and ${failures.join(', ')}`,
      };
    }
  }
  return undefined;
}

// Whether a browser keeps the cookie it received: neither a step above
// ignores it, nor does its line clear it. A rule on a cookie a browser keeps,
// its attributes or its contents, judges no other: a cookie a step ignores is
// that step's rule's, and a line that clears its cookie sets none.
export function keptByBrowser(
  cookie: ReceivedCookie,
  exchange: CookieExchange,
): boolean {
  return (
    !removesCookie(cookie) && ignoredInStorage(cookie, exchange) === undefined
  );
}

// Fetch Metadata (W3C), where a browser sends it: a request from a site other
// than the one it goes to, that is not a top-level navigation. A
// subresource request has a mode other than "navigate"; a nested navigation
// has the mode "navigate" and a destination other than "document". Missing
// headers show nothing, so they never make a request cross-site.
export function isCrossSiteSubresourceOrNestedNavigation(
  headers: CookieExchange['headers'],
): boolean {
  const field = (name: string): string | undefined => {
    const value = getHeader(headers, name);
    return (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();
  };
  if (field('sec-fetch-site') !== 'cross-site') {
    return false;
  }
  const mode = field('sec-fetch-mode');
  const dest = field('sec-fetch-dest');
  return (
    (mode !== undefined && mode !== 'navigate') ||
    (mode === 'navigate' && dest !== undefined && dest !== 'document')
  );
}
