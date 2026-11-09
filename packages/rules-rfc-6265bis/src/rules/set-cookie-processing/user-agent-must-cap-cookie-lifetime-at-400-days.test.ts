import type { HttpResponse, RuleFnResult } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  apiDescription,
  header,
  recorded,
  setCookieHeader,
  setCookieLines,
} from '../../test/builders.js';
import { runInContext } from '../../test/harness.js';
import rule from './user-agent-must-cap-cookie-lifetime-at-400-days.rule.js';

// An Expires is measured from the Date of the response that carries it, as a
// user agent receiving the response would measure it, never from the time of
// the run: an old recording, or a description's example date, must not read
// as long past.

const DATE = 'Wed, 21 Oct 2015 07:28:00 GMT';
const PAST_THE_CAP = 'SID=31d4; Expires=Fri, 25 Nov 2016 07:28:00 GMT';
const WITHIN_THE_CAP = 'SID=31d4; Expires=Tue, 16 Aug 2016 07:28:00 GMT';

const violations = (results: RuleFnResult[]) =>
  results.filter((result) => result.violation !== undefined);

const recordedWith = (line: string, date?: string) =>
  runInContext('analytics', rule, {
    transactions: [
      recorded({
        headers: {
          ...setCookieLines([line]),
          ...(date === undefined ? {} : { Date: date }),
        } as HttpResponse['headers'],
      }),
    ],
  });

const describedWith = (line: string, date: string) =>
  runInContext('static', rule, {
    format: apiDescription({
      response: {
        headers: { ...setCookieHeader(line), ...header('Date', date) },
      },
    }),
  });

describe('an Expires on a response with a Date', () => {
  it('is flagged when it lies 401 days after that Date', async () => {
    expect(violations(await recordedWith(PAST_THE_CAP, DATE))).toHaveLength(1);
    expect(violations(await describedWith(PAST_THE_CAP, DATE))).toHaveLength(1);
  });

  it('passes when it lies 300 days after that Date', async () => {
    expect(violations(await recordedWith(WITHIN_THE_CAP, DATE))).toEqual([]);
    expect(violations(await describedWith(WITHIN_THE_CAP, DATE))).toEqual([]);
  });
});

describe('an Expires on a response without a Date', () => {
  it('is measured from the time of the run', async () => {
    expect(violations(await recordedWith(PAST_THE_CAP))).toEqual([]);
    expect(
      violations(
        await recordedWith('SID=31d4; Expires=Wed, 01 Jan 2200 00:00:00 GMT'),
      ),
    ).toHaveLength(1);
  });
});
