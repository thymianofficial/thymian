import { describe, expect, it } from 'vitest';

import { onOneResponse } from '../../test/set-cookie.js';
import rule from './server-should-select-reasonable-cookie-expiration.rule.js';

// An Expires is measured from the Date of the response that carries it, as
// in the cap rule, never from the time of the run: an old recording, or a
// description's example date, must not read as long past.

const DATE = 'Wed, 21 Oct 2015 07:28:00 GMT';
const THIRTY_DAYS =
  '__Host-SID=31d4; Secure; Path=/; Expires=Fri, 20 Nov 2015 07:28:00 GMT';
const TEN_DAYS =
  '__Host-SID=31d4; Secure; Path=/; Expires=Sat, 31 Oct 2015 07:28:00 GMT';

// The Date is recorded with the response in `analytics`, and pinned by the
// API description in `static`.
describe.each(['analytics', 'static'] as const)(
  'in %s, a session identifier with an Expires',
  (context) => {
    it('is flagged when it lies 30 days after the Date of its response', async () => {
      expect(
        await onOneResponse(rule, context, [THIRTY_DAYS], {
          headers: { Date: DATE },
        }),
      ).toMatchObject({ status: 'failed' });
    });

    it('passes when it lies 10 days after that Date', async () => {
      expect(
        await onOneResponse(rule, context, [TEN_DAYS], {
          headers: { Date: DATE },
        }),
      ).toMatchObject({ status: 'passed' });
    });
  },
);
