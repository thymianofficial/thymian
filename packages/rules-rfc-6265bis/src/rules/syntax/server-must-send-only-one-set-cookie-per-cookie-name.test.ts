import { expect, it } from 'vitest';

import { onResponses } from '../../test/set-cookie.js';
import rule from './server-must-send-only-one-set-cookie-per-cookie-name.rule.js';

// Two field lines arrive as an array, from the server in `test` and from the
// recorded traffic in `analytics`. Each line on its own conforms: the defect
// is that both set SID. No `static`: an API description cannot hold two
// field lines of one header.
it.each(['test', 'analytics'] as const)(
  'flags, in %s, the response that sets one cookie-name twice',
  async (context) => {
    const {
      executions,
      transactions: [twice, distinct, withoutSetCookie],
    } = await onResponses(rule, context, [
      {
        lines: [
          'SID=31d4d96e407aad42; Path=/; Secure',
          'SID=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        ],
      },
      // Names that differ only in case are two cookies.
      { lines: ['SID=31d4d96e407aad42; Path=/; Secure', 'sid=en-US; Path=/'] },
      {},
    ]);

    expect(executions).toMatchObject([
      {
        location: { elementId: twice },
        status: 'failed',
        severity: 'error',
        message: expect.stringContaining(
          'This response sets the cookie "SID" 2 times',
        ),
      },
      { location: { elementId: distinct }, status: 'passed' },
      { location: { elementId: withoutSetCookie }, status: 'passed' },
    ]);
  },
);
