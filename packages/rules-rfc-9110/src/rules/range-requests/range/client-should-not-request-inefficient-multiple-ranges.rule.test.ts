import { describe, expect, it } from 'vitest';

import {
  rangeRequest,
  runAnalyticsRule,
} from '../../../../test/run-analytics-rule.js';
import rule from './client-should-not-request-inefficient-multiple-ranges.rule.js';

const run = (range: string | string[]) =>
  runAnalyticsRule(rule, [rangeRequest(range)]);

describe('rfc9110/client-should-not-request-inefficient-multiple-ranges (analytics)', () => {
  it.each([
    ['an open-ended range', 'bytes=0-'],
    ['a suffix range', 'bytes=-500'],
    ['ranges far apart', 'bytes=0-99, 1000-1099'],
    ['an open-ended range far after another', 'bytes=0-99, 1000-'],
    ['a suffix range beside an int range', 'bytes=-500, 0-99'],
  ])('reports nothing for %s', async (_, range) => {
    expect(await run(range)).toEqual([]);
  });

  it('reports a violation for ranges with a small gap', async () => {
    const [result] = await run('bytes=0-99, 150-199');

    expect(result?.violation?.message).toContain(
      'Gap between 99 and 150 is only 50 bytes',
    );
  });

  it('reports a violation for a range inside an open-ended one', async () => {
    const [result] = await run('bytes=0-, 500-999');

    expect(result?.violation?.message).toContain(
      'Ranges 0- and 500-999 overlap',
    );
  });

  it('reports a violation for an open-ended range shortly after another', async () => {
    const [result] = await run('bytes=0-99, 150-');

    expect(result?.violation?.message).toContain(
      'A single range 0- would be more efficient',
    );
  });

  it.each([
    ['a range spec it cannot parse', 'bytes=abc'],
    ['a last position before its first', 'bytes=500-499'],
    ['an empty value', ''],
    ['several field lines', ['bytes=0-99', 'bytes=200-299']],
  ])('skips a header with %s', async (_, range) => {
    const results = await run(range);

    expect(results).toHaveLength(1);
    expect(results[0]?.violation).toBeUndefined();
    expect(results[0]?.findings).toEqual([
      expect.objectContaining({ kind: 'rule-skip', title: rule.meta.name }),
    ]);
  });
});
