import type { HttpResponse, RuleFnResult } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  apiDescription,
  recorded,
  setCookieHeader,
  setCookieLines,
} from '../../test/builders.js';
import { runInContext } from '../../test/harness.js';
import rule from './server-should-set-secure-on-every-cookie-over-secure-channel.rule.js';

// A line that clears its cookie sets none, so the rule leaves it out. Whether
// it clears it is judged against the Date of its response, never the time of
// the run: an old recording, or a description's example date, must not let
// a cookie without Secure through.

const PAST = 'SID=31d4d96e407aad42; Expires=Wed, 21 Oct 2015 07:28:00 GMT';
const EPOCH = 'SID=; Expires=Thu, 01 Jan 1970 00:00:00 GMT';

const violations = (results: RuleFnResult[]) =>
  results.filter((result) => result.violation !== undefined);

const recordedOverHttps = (line: string, date?: string) =>
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

const describedOverHttps = (line: string) =>
  runInContext('static', rule, {
    format: apiDescription({ response: { headers: setCookieHeader(line) } }),
  });

describe('a cookie without Secure over https', () => {
  it('is flagged when its Expires lies in the past but its response has no Date', async () => {
    expect(violations(await recordedOverHttps(PAST))).toHaveLength(1);
    expect(violations(await describedOverHttps(PAST))).toHaveLength(1);
  });

  it('is flagged when its Expires lies after the Date of its response', async () => {
    const results = await recordedOverHttps(
      PAST,
      'Tue, 20 Oct 2015 07:28:00 GMT',
    );

    expect(violations(results)).toHaveLength(1);
  });

  it('is left out when its Expires is at or before the Date of its response', async () => {
    const results = await recordedOverHttps(
      PAST,
      'Thu, 22 Oct 2015 07:28:00 GMT',
    );

    expect(violations(results)).toEqual([]);
  });

  it('is left out when its Expires is the epoch, with no Date', async () => {
    expect(violations(await recordedOverHttps(EPOCH))).toEqual([]);
    expect(violations(await describedOverHttps(EPOCH))).toEqual([]);
  });
});
