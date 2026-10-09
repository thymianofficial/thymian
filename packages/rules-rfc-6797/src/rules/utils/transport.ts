// The transport a request travelled over, as far as a rule may judge it.

import type { RuleFnResult, RuleViolationLocation } from '@thymian/core';

import { ruleSkip } from './results.js';

// A document with no `servers` entry, a relative server URL, or a variable
// in the scheme or port that cannot be resolved is loaded as
// `http://localhost:8080`: the scheme is Thymian's fallback, not the API's.
// A rule judging the scheme skips exactly that origin in `static` and in
// `test`, whose requests carry the described origin even when sent to a
// target URL, rather than report a transport the description never declared.
// A description that really declares `http://localhost:8080` is a local
// development server, where HSTS is not demanded in practice either.
// `analytics` never skips it: recorded traffic is real.
const SERVER_FALLBACK_ORIGIN = 'http://localhost:8080';

export function isServerFallbackOrigin(origin: string): boolean {
  try {
    return new URL(origin).origin === SERVER_FALLBACK_ORIGIN;
  } catch {
    return false;
  }
}

export function serverFallbackSkip(
  location: RuleViolationLocation,
  ruleName: string,
): RuleFnResult {
  return ruleSkip(
    location,
    ruleName,
    `This request is served from ${SERVER_FALLBACK_ORIGIN}, which is also what Thymian loads an API description without a usable server URL as, so its scheme may be Thymian's rather than the API's and the transport is not judged.`,
  );
}
