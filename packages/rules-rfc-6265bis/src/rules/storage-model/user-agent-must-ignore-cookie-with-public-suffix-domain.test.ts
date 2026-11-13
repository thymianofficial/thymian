import { expect, it } from 'vitest';

import { FALLBACK, onResponses, SECURE } from '../../test/set-cookie.js';
import rule from './user-agent-must-ignore-cookie-with-public-suffix-domain.rule.js';

// api.example.com domain-matches both com, a public suffix, and example.com,
// its registrable domain.
const PUBLIC_SUFFIX = 'SID=31d4d96e407aad42; Domain=com';
const REGISTRABLE_DOMAIN = 'SID=31d4d96e407aad42; Domain=example.com';

const flagged = {
  status: 'failed',
  severity: 'warn',
  message: expect.stringContaining(
    'its Domain attribute, com, is a single label, which every public suffix list treats as a public suffix, and it is not the request host api.example.com',
  ),
};

// On http://localhost:8080 the request host may be Thymian's rather than the
// API's, and the requests of `test` carry the described origin, so both
// contexts skip a single-label Domain there.
it.each(['static', 'test'] as const)(
  'flags, in %s, a single-label Domain and skips the server URL fallback',
  async (context) => {
    const {
      executions,
      transactions: [publicSuffix, registrableDomain, onFallback],
    } = await onResponses(rule, context, [
      { origin: SECURE, lines: [PUBLIC_SUFFIX] },
      { origin: SECURE, lines: [REGISTRABLE_DOMAIN] },
      { origin: FALLBACK, lines: [PUBLIC_SUFFIX] },
    ]);

    expect(executions).toMatchObject([
      { location: { elementId: publicSuffix }, ...flagged },
      { location: { elementId: registrableDomain }, status: 'passed' },
      {
        location: { elementId: onFallback },
        status: 'skipped',
        reason: expect.stringContaining('loopback host'),
      },
    ]);
  },
);

// Recorded traffic is real: localhost is judged like any other host, and a
// single-label Domain identical to it makes the cookie host-only instead.
it('flags, in analytics, a single-label Domain that is not the request host', async () => {
  const {
    executions,
    transactions: [publicSuffix, registrableDomain, hostItself],
  } = await onResponses(rule, 'analytics', [
    { origin: SECURE, lines: [PUBLIC_SUFFIX] },
    { origin: SECURE, lines: [REGISTRABLE_DOMAIN] },
    { origin: FALLBACK, lines: ['SID=31d4d96e407aad42; Domain=localhost'] },
  ]);

  expect(executions).toMatchObject([
    { location: { elementId: publicSuffix }, ...flagged },
    { location: { elementId: registrableDomain }, status: 'passed' },
    { location: { elementId: hostItself }, status: 'passed' },
  ]);
});
