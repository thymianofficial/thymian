import { expect, it } from 'vitest';

import {
  contexts,
  FALLBACK,
  onResponses,
  SECURE,
} from '../../test/set-cookie.js';
import rule from './user-agent-must-ignore-cookie-with-non-matching-domain.rule.js';

// api.example.com domain-matches example.com and not example.org.
const FOREIGN_DOMAIN = 'SID=31d4d96e407aad42; Domain=example.org';
const PARENT_DOMAIN = 'SID=31d4d96e407aad42; Domain=example.com';

it.each(contexts)(
  'flags, in %s, a Domain the request host does not domain-match',
  async (context) => {
    const {
      executions,
      transactions: [foreignDomain, parentDomain, onFallback],
    } = await onResponses(rule, context, [
      { origin: SECURE, lines: [FOREIGN_DOMAIN] },
      { origin: SECURE, lines: [PARENT_DOMAIN] },
      { origin: FALLBACK, lines: [PARENT_DOMAIN] },
    ]);

    expect(executions).toMatchObject([
      {
        location: { elementId: foreignDomain },
        status: 'failed',
        severity: 'error',
        message: expect.stringContaining(
          'A user agent ignores the cookie "SID" entirely (§5.7 step 10): the request host api.example.com does not domain-match its Domain attribute, example.org.',
        ),
      },
      { location: { elementId: parentDomain }, status: 'passed' },
      // On http://localhost:8080 the request host may be Thymian's rather
      // than the API's, so `static` and `test`, whose requests carry the
      // described origin, skip it. Recorded traffic is real: localhost is
      // judged like any other host, and does not domain-match example.com.
      context === 'analytics'
        ? {
            location: { elementId: onFallback },
            status: 'failed',
            message: expect.stringContaining(
              'the request host localhost does not domain-match its Domain attribute, example.com',
            ),
          }
        : {
            location: { elementId: onFallback },
            status: 'skipped',
            reason: expect.stringContaining('loopback host'),
          },
    ]);
  },
);
