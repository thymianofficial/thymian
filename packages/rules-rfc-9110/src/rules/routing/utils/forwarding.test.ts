import type {
  CapturedTrace,
  CapturedTransaction,
  HttpParticipantRole,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  connectionOptionNames,
  equalHeaderValues,
  forwardingHops,
  headerValues,
  parseMaxForwards,
  splitTopLevelCommas,
} from './forwarding.js';

function transaction(roles: {
  requestRole?: HttpParticipantRole;
  responseRole?: HttpParticipantRole;
}): CapturedTransaction {
  return {
    request: {
      data: {
        method: 'get',
        origin: 'https://example.com',
        path: '/resource',
        headers: {},
      },
      meta: { role: roles.requestRole },
    },
    response: {
      data: {
        statusCode: 200,
        headers: {},
        trailers: {},
        duration: 1,
      },
      meta: { role: roles.responseRole },
    },
  };
}

describe('forwardingHops', () => {
  it('yields no hops for empty and single-transaction traces', () => {
    expect(forwardingHops([])).toEqual([]);
    expect(
      forwardingHops([transaction({ requestRole: 'user-agent' })]),
    ).toEqual([]);
  });

  it('pairs the inbound transaction with the onward outbound transaction', () => {
    const inbound = transaction({
      requestRole: 'user-agent',
      responseRole: 'proxy',
    });
    const outbound = transaction({
      requestRole: 'proxy',
      responseRole: 'origin server',
    });
    const trace: CapturedTrace = [inbound, outbound];

    const hops = forwardingHops(trace);

    expect(hops).toHaveLength(1);
    expect(hops[0]?.inbound).toBe(inbound);
    expect(hops[0]?.outbound).toBe(outbound);
  });

  it('matches concrete intermediary roles via umbrella expansion by default', () => {
    for (const role of [
      'intermediary',
      'proxy',
      'gateway',
      'tunnel',
    ] as const) {
      const trace: CapturedTrace = [
        transaction({ requestRole: 'user-agent' }),
        transaction({ requestRole: role }),
      ];
      expect(forwardingHops(trace)).toHaveLength(1);
    }
  });

  it('filters hops by the requested middle-participant role', () => {
    const trace: CapturedTrace = [
      transaction({ requestRole: 'user-agent' }),
      transaction({ requestRole: 'gateway' }),
    ];

    expect(forwardingHops(trace, ['gateway'])).toHaveLength(1);
    expect(forwardingHops(trace, ['proxy'])).toEqual([]);
  });

  it('identifies the middle participant from the inbound response when the outbound request is unstamped', () => {
    const trace: CapturedTrace = [
      transaction({ requestRole: 'user-agent', responseRole: 'proxy' }),
      transaction({ responseRole: 'origin server' }),
    ];

    expect(forwardingHops(trace, ['proxy'])).toHaveLength(1);
  });

  it('yields no hops when no middle-participant role is stamped', () => {
    const trace: CapturedTrace = [
      transaction({ requestRole: 'user-agent' }),
      transaction({ responseRole: 'origin server' }),
    ];

    expect(forwardingHops(trace)).toEqual([]);
  });

  it('pairs every adjacent transaction of longer chains', () => {
    const edge = transaction({
      requestRole: 'user-agent',
      responseRole: 'gateway',
    });
    const middle = transaction({
      requestRole: 'gateway',
      responseRole: 'proxy',
    });
    const origin = transaction({
      requestRole: 'proxy',
      responseRole: 'origin server',
    });
    const trace: CapturedTrace = [edge, middle, origin];

    const hops = forwardingHops(trace);

    expect(hops).toHaveLength(2);
    expect(hops[0]?.inbound).toBe(edge);
    expect(hops[0]?.outbound).toBe(middle);
    expect(hops[1]?.inbound).toBe(middle);
    expect(hops[1]?.outbound).toBe(origin);
  });
});

describe('headerValues', () => {
  it('normalizes undefined, single and multi values to arrays', () => {
    expect(headerValues(undefined)).toEqual([]);
    expect(headerValues('a')).toEqual(['a']);
    expect(headerValues(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('equalHeaderValues', () => {
  it('compares values ignoring order and surrounding whitespace', () => {
    expect(equalHeaderValues(' a ', 'a')).toBe(true);
    expect(equalHeaderValues(['a', 'b'], ['b', ' a'])).toBe(true);
    expect(equalHeaderValues(['a'], ['a', 'a'])).toBe(false);
    expect(equalHeaderValues('a', undefined)).toBe(false);
    expect(equalHeaderValues(undefined, undefined)).toBe(true);
  });
});

describe('connectionOptionNames', () => {
  it('splits, trims, lowercases and drops empty options', () => {
    expect(connectionOptionNames('Keep-Alive, , Upgrade')).toEqual([
      'keep-alive',
      'upgrade',
    ]);
    expect(connectionOptionNames(['close', 'TE, trailers'])).toEqual([
      'close',
      'te',
      'trailers',
    ]);
    expect(connectionOptionNames(undefined)).toEqual([]);
  });
});

describe('parseMaxForwards', () => {
  it('parses the first value and rejects non-numeric input', () => {
    expect(parseMaxForwards('5')).toBe(5);
    expect(parseMaxForwards([' 3 ', '9'])).toBe(3);
    expect(parseMaxForwards('abc')).toBeUndefined();
    expect(parseMaxForwards(undefined)).toBeUndefined();
  });

  it('rejects partially-numeric, list, and negative values', () => {
    expect(parseMaxForwards('5abc')).toBeUndefined();
    expect(parseMaxForwards('5, 6')).toBeUndefined();
    expect(parseMaxForwards('-1')).toBeUndefined();
  });

  it('parses zero (the boundary the zero-handling rules rely on)', () => {
    expect(parseMaxForwards('0')).toBe(0);
  });
});

describe('splitTopLevelCommas', () => {
  it('splits on top-level commas', () => {
    expect(splitTopLevelCommas('1.1 a, 1.1 b')).toEqual(['1.1 a', ' 1.1 b']);
  });

  it('ignores commas inside parenthesised comments', () => {
    expect(splitTopLevelCommas('1.1 a (x, y), 1.1 b')).toEqual([
      '1.1 a (x, y)',
      ' 1.1 b',
    ]);
  });

  it('handles nested comments and quoted-pairs', () => {
    expect(splitTopLevelCommas('1.1 a (outer (in, ner)), 1.1 b')).toEqual([
      '1.1 a (outer (in, ner))',
      ' 1.1 b',
    ]);
    expect(splitTopLevelCommas('1.1 a (esc\\), still), 1.1 b')).toEqual([
      '1.1 a (esc\\), still)',
      ' 1.1 b',
    ]);
  });

  it('returns the whole value when there is no top-level comma', () => {
    expect(splitTopLevelCommas('1.1 a (x, y)')).toEqual(['1.1 a (x, y)']);
    expect(splitTopLevelCommas('')).toEqual(['']);
  });
});
