import { expect, it } from 'vitest';

import { onResponses } from '../../test/set-cookie.js';
import rule from './origin-server-may-send-set-cookie-with-any-response.rule.js';

const flagged = {
  status: 'failed',
  severity: 'hint',
  message:
    'This response carries no Set-Cookie header field. Draft-22 lets an origin server send Set-Cookie with any response; this one does not use it.',
};

// Presence is a header name, so `static` needs no pinned value: a declared
// Set-Cookie uses the mechanism whatever its value.
it('flags, in static, a final response that declares no Set-Cookie', async () => {
  const {
    executions,
    transactions: [withoutSetCookie, withSetCookie, interim],
  } = await onResponses(rule, 'static', [
    {},
    { lines: [] },
    // A user agent may ignore a Set-Cookie on a 1xx response, so the rule
    // does not ask for one there.
    { statusCode: 103 },
  ]);

  expect(executions).toMatchObject([
    { location: { elementId: withoutSetCookie }, ...flagged },
    { location: { elementId: withSetCookie }, status: 'passed' },
    { location: { elementId: interim }, status: 'notApplicable' },
  ]);
});

// The API description declares no Set-Cookie: the header counts where the
// server sends it, or the recording holds it.
it.each(['test', 'analytics'] as const)(
  'flags, in %s, a response without a Set-Cookie',
  async (context) => {
    const {
      executions,
      transactions: [withoutSetCookie, withSetCookie],
    } = await onResponses(rule, context, [
      {},
      { lines: ['SID=31d4d96e407aad42; Path=/; Secure'] },
    ]);

    expect(executions).toMatchObject([
      { location: { elementId: withoutSetCookie }, ...flagged },
      { location: { elementId: withSetCookie }, status: 'passed' },
    ]);
  },
);
