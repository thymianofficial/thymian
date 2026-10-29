import type { HttpResponse, RuleFnResult } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  apiDescription,
  recorded,
  setCookieHeader,
  setCookieLines,
} from '../../test/builders.js';
import { runInContext } from '../../test/harness.js';
import rule from './server-should-avoid-large-cookies.rule.js';

// Whether a line removes its cookie decides what a browser's store holds,
// and so what the rule counts. Fifty cookies is what draft-22 asks a
// browser to keep; a second response that clears one of them and sets
// another leaves fifty if the clearing line removes its cookie, and
// fifty-one, past the number, if it does not.

const FIFTY = Array.from({ length: 50 }, (_, index) => `c${index}=1`);

const violations = (results: RuleFnResult[]) =>
  results.filter((result) => result.violation !== undefined);

const recordedLines = (lines: string[], date?: string) =>
  recorded({
    headers: {
      ...setCookieLines(lines),
      ...(date === undefined ? {} : { Date: date }),
    } as HttpResponse['headers'],
  });

// Recorded in `analytics`: the fifty, then the clearing line on a response
// that carries `date`, or no Date at all.
const clearingRecorded = (clearing: string, date?: string) =>
  runInContext('analytics', rule, {
    transactions: [
      recordedLines(FIFTY),
      recordedLines([clearing, 'replacement=1'], date),
    ],
  });

// Pinned in `static`, where a description rarely pins a Date: one response
// per line, as a browser's store collects them.
const clearingDescribed = (clearing: string) =>
  runInContext('static', rule, {
    format: apiDescription(
      ...[...FIFTY, clearing, 'replacement=1'].map((line, index) => ({
        request: { path: `/${index}` },
        response: { headers: setCookieHeader(line) },
      })),
    ),
  });

describe('a line removes its cookie', () => {
  it('when its Expires is at or before the Date of its response', async () => {
    const results = await clearingRecorded(
      'c0=; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
      'Thu, 22 Oct 2015 07:28:00 GMT',
    );

    expect(violations(results)).toEqual([]);
  });

  it('not when its Expires is after the Date of its response, however long ago that was', async () => {
    const results = await clearingRecorded(
      'c0=; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
      'Tue, 20 Oct 2015 07:28:00 GMT',
    );

    expect(violations(results)).toHaveLength(1);
  });

  it('without a Date, only when its Expires is at or before the epoch', async () => {
    const epoch = await clearingRecorded(
      'c0=; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
    const past = await clearingRecorded(
      'c0=; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
    );

    expect(violations(epoch)).toEqual([]);
    expect(violations(past)).toHaveLength(1);
  });

  it('when its last Max-Age is zero or less, whatever its Date', async () => {
    const lastZero = await clearingRecorded(
      'c0=; Max-Age=60; Max-Age=0',
      'Tue, 20 Oct 2015 07:28:00 GMT',
    );
    const lastPositive = await clearingRecorded(
      'c0=; Max-Age=0; Max-Age=60',
      'Tue, 20 Oct 2015 07:28:00 GMT',
    );

    expect(violations(lastZero)).toEqual([]);
    expect(violations(lastPositive)).toHaveLength(1);
  });

  it('not when a Max-Age keeps it, even beside an Expires at the epoch', async () => {
    const results = await clearingRecorded(
      'c0=; Max-Age=60; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );

    expect(violations(results)).toHaveLength(1);
  });

  it('in an API description, which pins no Date, only at the epoch', async () => {
    const epoch = await clearingDescribed(
      'c0=; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
    const past = await clearingDescribed(
      'c0=; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
    );

    expect(violations(epoch)).toEqual([]);
    expect(violations(past)).toHaveLength(1);
  });
});

// A cookie of 3000 octets of name and value: three make a Cookie header of
// 9007 octets, past the 8192 of many servers; two and a small one stay under.
const large = (name: string) => `${name}=${'x'.repeat(3000 - name.length)}`;
const SHRINKING = [[large('A'), large('B')], ['A=1'], [large('C')]];

describe('a cookie set again', () => {
  it('holds the value it was set to last, in traffic a browser received', async () => {
    const results = await runInContext('analytics', rule, {
      transactions: SHRINKING.map((lines) => recordedLines(lines)),
    });

    expect(violations(results)).toEqual([]);
  });

  // Each pinned value is one the server may set, in no order a browser
  // would see, so a description counts the largest.
  it('holds the largest value it may be set to, in an API description', async () => {
    const results = await runInContext('static', rule, {
      format: apiDescription(
        ...SHRINKING.flat().map((line, index) => ({
          request: { path: `/${index}` },
          response: { headers: setCookieHeader(line) },
        })),
      ),
    });

    expect(violations(results)).toHaveLength(1);
  });
});

// §5.8.3 step 6 serializes a nameless cookie as its value alone. Two
// cookie-pairs of 3001 octets and a nameless value of 2186 make a Cookie
// header of exactly 8192 octets with the two "; " between them; an "="
// before the nameless value would take it one past.
it('counts a nameless cookie as its value alone', async () => {
  const results = await runInContext('analytics', rule, {
    transactions: [
      recordedLines([large('A'), large('B'), `=${'v'.repeat(2186)}`]),
    ],
  });

  expect(violations(results)).toEqual([]);
});
