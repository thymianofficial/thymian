import { describe, expect, it } from 'vitest';

import { onOneResponse } from '../../test/set-cookie.js';
import rule from './user-agent-must-cap-cookie-lifetime-at-400-days.rule.js';

// An Expires is measured from the Date of the response that carries it, as a
// user agent receiving the response would measure it, never from the time of
// the run: an old recording, or a description's example date, must not read
// as long past.

const DATE = 'Wed, 21 Oct 2015 07:28:00 GMT';
const PAST_THE_CAP = 'SID=31d4; Expires=Fri, 25 Nov 2016 07:28:00 GMT';
const WITHIN_THE_CAP = 'SID=31d4; Expires=Tue, 16 Aug 2016 07:28:00 GMT';

// The Date is recorded with the response in `analytics`, and pinned by the
// API description in `static`.
describe.each(['analytics', 'static'] as const)(
  'in %s, an Expires on a response with a Date',
  (context) => {
    it('is flagged when it lies 401 days after that Date', async () => {
      expect(
        await onOneResponse(rule, context, [PAST_THE_CAP], {
          headers: { Date: DATE },
        }),
      ).toMatchObject({ status: 'failed' });
    });

    it('passes when it lies 300 days after that Date', async () => {
      expect(
        await onOneResponse(rule, context, [WITHIN_THE_CAP], {
          headers: { Date: DATE },
        }),
      ).toMatchObject({ status: 'passed' });
    });
  },
);

describe('an Expires on a recorded response without a Date', () => {
  it('is measured from the time of the run', async () => {
    expect(
      await onOneResponse(rule, 'analytics', [PAST_THE_CAP]),
    ).toMatchObject({ status: 'passed' });
    expect(
      await onOneResponse(rule, 'analytics', [
        'SID=31d4; Expires=Wed, 01 Jan 2200 00:00:00 GMT',
      ]),
    ).toMatchObject({ status: 'failed' });
  });
});
