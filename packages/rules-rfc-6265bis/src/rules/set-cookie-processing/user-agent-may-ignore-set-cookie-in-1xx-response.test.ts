import { expect, it } from 'vitest';

import { onResponses } from '../../test/set-cookie.js';
import rule from './user-agent-may-ignore-set-cookie-in-1xx-response.rule.js';

// `static` only: core does not capture a 1xx interim response as a
// transaction of its own. Presence on a status code is a header name, so no
// value need be pinned.
it('flags, in static, a 1xx response that declares Set-Cookie', async () => {
  const {
    executions,
    transactions: [interimWithSetCookie, finalWithSetCookie, interimWithout],
  } = await onResponses(rule, 'static', [
    { statusCode: 103, lines: [] },
    { lines: [] },
    { statusCode: 103 },
  ]);

  expect(executions).toMatchObject([
    {
      location: { elementId: interimWithSetCookie },
      status: 'failed',
      severity: 'hint',
      message: expect.stringContaining(
        'This 103 response declares a Set-Cookie header field.',
      ),
    },
    // The rule speaks about a Set-Cookie on a 1xx response only.
    { location: { elementId: finalWithSetCookie }, status: 'notApplicable' },
    { location: { elementId: interimWithout }, status: 'notApplicable' },
  ]);
});
