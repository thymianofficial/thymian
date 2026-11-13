import type { RuleTestExecutionStatus } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import {
  type Answer,
  type Context,
  onResponses,
  SECURE,
} from '../../test/set-cookie.js';
import rule from './server-should-avoid-large-cookies.rule.js';

// The rule keeps a store per host across the responses it is shown, so its
// tests are about several responses: which of them takes the host past a
// number, and that the ones before it are accepted.

// What the rule says about the answers given, in the order given. `each`
// spells the executions expected, one status per answer.
async function answered(context: Context, answers: Answer[]) {
  const { executions, transactions } = await onResponses(
    rule,
    context,
    answers,
  );

  return {
    executions,
    each: (...statuses: RuleTestExecutionStatus[]) =>
      transactions.map((transaction, index) => ({
        location: { elementId: transaction },
        status: statuses[index],
      })),
  };
}

// A cookie of 3000 octets of name and value: one is well under a browser's
// 4096 per cookie, three of them make a Cookie header of 9007 octets, past
// the 8192 of many servers, and two make one of 6004.
const large = (name: string) => `${name}=${'x'.repeat(3000 - name.length)}`;

// Fifty cookies is what draft-22 asks a browser to keep for one domain at
// least; the fifty-first is one it may evict.
const small = (count: number) =>
  Array.from({ length: count }, (_, index) => `c${index}=1`);

const FIFTY = small(50);

const OTHER_HOST = { ...SECURE, host: 'www.example.com' } as const;

const PAST_THE_OCTETS = {
  severity: 'warn',
  message: expect.stringContaining(
    'the server has set 3 cookies for api.example.com, which a browser sends back in a Cookie header of 9007 octets',
  ),
};
const PAST_THE_NUMBER = {
  severity: 'warn',
  message: expect.stringContaining(
    'the server has set 51 cookies for api.example.com',
  ),
};

// One response, one Set-Cookie: `static` sees the cookie-string grow over the
// responses of the description, as a browser's store does.
describe('in static', () => {
  it('flags the response whose pinned cookie takes the host past 8192 octets', async () => {
    const { executions, each } = await answered('static', [
      { lines: [large('A')] },
      { lines: [large('B')] },
      { lines: [large('C')] },
      // Declared without a value: its size cannot be read, which is a skip
      // and not a pass.
      { lines: [] },
      {},
    ]);

    expect(executions).toMatchObject(
      each('passed', 'passed', 'failed', 'skipped', 'notApplicable'),
    );
    expect(executions[2]).toMatchObject(PAST_THE_OCTETS);
    expect(executions[3]).toMatchObject({
      reason: expect.stringContaining('without pinning its value'),
    });
  });

  // Three responses that each set the same large cookie hold one cookie, not
  // three.
  it('accepts responses that set one large cookie again', async () => {
    const { executions, each } = await answered('static', [
      { lines: [large('SID')] },
      { lines: [large('SID')] },
      { lines: [large('SID')] },
    ]);

    expect(executions).toMatchObject(each('passed', 'passed', 'passed'));
  });
});

// The API description declares no Set-Cookie at all: a server that sets
// cookies anyway is what a rule that only looked at declared headers would
// miss.
describe('in test', () => {
  it('flags the response that sets a fifty-first cookie', async () => {
    const { executions, each } = await answered('test', [{ lines: small(51) }]);

    expect(executions).toMatchObject(each('failed'));
    expect(executions[0]).toMatchObject(PAST_THE_NUMBER);
  });

  // Two requests to one host: the first sets fifty cookies, the second
  // clears one of them and sets another, which leaves fifty in the store. It
  // passes only because `test` validates the first before the second: the
  // other way round, the clearing line would clear nothing, and the fifty
  // would make fifty-one.
  it('accepts a response that clears one of fifty cookies and sets another', async () => {
    const { executions, each } = await answered('test', [
      { lines: FIFTY },
      { lines: ['c0=; Max-Age=0', 'replacement=1'] },
    ]);

    expect(executions).toMatchObject(each('passed', 'passed'));
  });
});

// The cookies of two responses add up for the host that set them both; the
// same two responses from two hosts are two cookie-strings.
describe('in analytics', () => {
  it('flags the recorded response that takes its host past 8192 octets', async () => {
    const { executions, each } = await answered('analytics', [
      { lines: [large('A'), large('B')] },
      { lines: [large('C')] },
    ]);

    expect(executions).toMatchObject(each('passed', 'failed'));
    expect(executions[1]).toMatchObject(PAST_THE_OCTETS);
  });

  it('accepts the same responses recorded from two hosts', async () => {
    const { executions, each } = await answered('analytics', [
      { lines: [large('A'), large('B')] },
      { lines: [large('C')], origin: OTHER_HOST },
    ]);

    expect(executions).toMatchObject(each('passed', 'passed'));
  });
});

// Whether a line removes its cookie decides what a browser's store holds,
// and so what the rule counts. A second response that clears one of fifty
// cookies and sets another leaves fifty if the clearing line removes its
// cookie, and fifty-one, past the number, if it does not: the response that
// sets the replacement is then the one that is flagged.

// Recorded in `analytics`: the fifty, then the clearing line on a response
// that carries `date`, or no Date at all.
const clearingRecorded = (clearing: string, date?: string) =>
  answered('analytics', [
    { lines: FIFTY },
    {
      lines: [clearing, 'replacement=1'],
      headers: date === undefined ? {} : { Date: date },
    },
  ]);

// Pinned in `static`, where a description rarely pins a Date: one response
// per line, as a browser's store collects them. The last one sets the
// replacement; the fifty-one before it are accepted either way.
const clearingDescribed = (clearing: string) =>
  answered(
    'static',
    [...FIFTY, clearing, 'replacement=1'].map((line) => ({ lines: [line] })),
  );
const afterFiftyOnePassed = (last: 'passed' | 'failed') => [
  ...Array.from({ length: 51 }, () => 'passed' as const),
  last,
];

describe('a line removes its cookie', () => {
  it('when its Expires is at or before the Date of its response', async () => {
    const { executions, each } = await clearingRecorded(
      'c0=; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
      'Thu, 22 Oct 2015 07:28:00 GMT',
    );

    expect(executions).toMatchObject(each('passed', 'passed'));
  });

  it('not when its Expires is after the Date of its response, however long ago that was', async () => {
    const { executions, each } = await clearingRecorded(
      'c0=; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
      'Tue, 20 Oct 2015 07:28:00 GMT',
    );

    expect(executions).toMatchObject(each('passed', 'failed'));
  });

  it('without a Date, only when its Expires is at or before the epoch', async () => {
    const epoch = await clearingRecorded(
      'c0=; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
    const past = await clearingRecorded(
      'c0=; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
    );

    expect(epoch.executions).toMatchObject(epoch.each('passed', 'passed'));
    expect(past.executions).toMatchObject(past.each('passed', 'failed'));
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

    expect(lastZero.executions).toMatchObject(
      lastZero.each('passed', 'passed'),
    );
    expect(lastPositive.executions).toMatchObject(
      lastPositive.each('passed', 'failed'),
    );
  });

  it('not when a Max-Age keeps it, even beside an Expires at the epoch', async () => {
    const { executions, each } = await clearingRecorded(
      'c0=; Max-Age=60; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );

    expect(executions).toMatchObject(each('passed', 'failed'));
  });

  it('in an API description, which pins no Date, only at the epoch', async () => {
    const epoch = await clearingDescribed(
      'c0=; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
    const past = await clearingDescribed(
      'c0=; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
    );

    expect(epoch.executions).toMatchObject(
      epoch.each(...afterFiftyOnePassed('passed')),
    );
    expect(past.executions).toMatchObject(
      past.each(...afterFiftyOnePassed('failed')),
    );
  });
});

// Two large cookies, then the first set again to a small value, then a third
// large one: two large and a small one stay under 8192 octets, three large
// ones do not.
const SHRINKING = [[large('A'), large('B')], ['A=1'], [large('C')]];

describe('a cookie set again', () => {
  it('holds the value it was set to last, in traffic a browser received', async () => {
    const { executions, each } = await answered(
      'analytics',
      SHRINKING.map((lines) => ({ lines })),
    );

    expect(executions).toMatchObject(each('passed', 'passed', 'passed'));
  });

  // Each pinned value is one the server may set, in no order a browser
  // would see, so a description counts the largest: the response that pins
  // the third large cookie is flagged.
  it('holds the largest value it may be set to, in an API description', async () => {
    const { executions, each } = await answered(
      'static',
      SHRINKING.flat().map((line) => ({ lines: [line] })),
    );

    expect(executions).toMatchObject(
      each('passed', 'passed', 'passed', 'failed'),
    );
  });
});

// §5.8.3 step 6 serializes a nameless cookie as its value alone. Two
// cookie-pairs of 3001 octets and a nameless value of 2186 make a Cookie
// header of exactly 8192 octets with the two "; " between them; an "="
// before the nameless value would take it one past.
it('counts a nameless cookie as its value alone', async () => {
  const { executions, each } = await answered('analytics', [
    { lines: [large('A'), large('B'), `=${'v'.repeat(2186)}`] },
  ]);

  expect(executions).toMatchObject(each('passed'));
});
