// The transport a request travelled over, as far as a rule may judge it.

import type { RuleFnResult, RuleViolationLocation } from '@thymian/core';

import { ruleSkip } from './results.js';

// A document with no `servers` entry, a relative server URL, or a variable
// in the scheme or port that cannot be resolved is loaded as
// `http://localhost:8080`: the host and scheme are Thymian's fallback, not the
// API's. A document that does declare servers is loaded from the first one
// on a localhost URL, if any, before its first entry: a description that
// lists a local development server beside the deployed API is checked
// against the development server.
// A rule judging the host or scheme skips every loopback host in `static`
// and in `test`, whose requests carry the described origin even when sent to
// a target URL, rather than report a transport the description never
// declared, or one of a development server, which is not what a rule on the
// deployed API is about.
// `analytics` never skips one: recorded traffic is real.
const SERVER_FALLBACK_ORIGIN = 'http://localhost:8080';

// `localhost` and the names under it (RFC 6761 §6.3), 127.0.0.0/8 and ::1.
export function isLoopbackOrigin(origin: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    hostname === '[::1]'
  );
}

export function loopbackSkip(
  location: RuleViolationLocation,
  ruleName: string,
): RuleFnResult {
  return ruleSkip(
    location,
    ruleName,
    `This request is served from a loopback host: what Thymian loads an API description without a usable server URL as (${SERVER_FALLBACK_ORIGIN}), or a local development server the description declares. Its host and scheme are not the deployed API's, so the transport is not judged.`,
  );
}
