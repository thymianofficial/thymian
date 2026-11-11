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
import rule from './server-should-select-reasonable-cookie-expiration.rule.js';

// An Expires is measured from the Date of the response that carries it, as
// in the cap rule, never from the time of the run: an old recording, or a
// description's example date, must not read as long past.

const DATE = 'Wed, 21 Oct 2015 07:28:00 GMT';
const THIRTY_DAYS =
  '__Host-SID=31d4; Secure; Path=/; Expires=Fri, 20 Nov 2015 07:28:00 GMT';
const TEN_DAYS =
  '__Host-SID=31d4; Secure; Path=/; Expires=Sat, 31 Oct 2015 07:28:00 GMT';

const violations = (results: RuleFnResult[]) =>
  results.filter((result) => result.violation !== undefined);

const recordedWith = (line: string) =>
  runInContext('analytics', rule, {
    transactions: [
      recorded({
        headers: {
          ...setCookieLines([line]),
          Date: DATE,
        } as HttpResponse['headers'],
      }),
    ],
  });

const describedWith = (line: string) =>
  runInContext('static', rule, {
    format: apiDescription({
      response: {
        headers: { ...setCookieHeader(line), ...header('Date', DATE) },
      },
    }),
  });

describe('a session identifier with an Expires', () => {
  it('is flagged when it lies 30 days after the Date of its response', async () => {
    expect(violations(await recordedWith(THIRTY_DAYS))).toHaveLength(1);
    expect(violations(await describedWith(THIRTY_DAYS))).toHaveLength(1);
  });

  it('passes when it lies 10 days after that Date', async () => {
    expect(violations(await recordedWith(TEN_DAYS))).toEqual([]);
    expect(violations(await describedWith(TEN_DAYS))).toEqual([]);
  });
});
