import { describe, expect, it } from 'vitest';

import {
  rangeRequest,
  runAnalyticsRule,
} from '../../../../test/run-analytics-rule.js';
import rule from './client-should-list-multiple-ranges-in-ascending-order.rule.js';

const run = (range: string | string[]) =>
  runAnalyticsRule(rule, [rangeRequest(range)]);

describe('rfc9110/client-should-list-multiple-ranges-in-ascending-order (analytics)', () => {
  it.each([
    ['an open-ended range', 'bytes=0-'],
    ['a suffix range', 'bytes=-500'],
    ['ascending ranges', 'bytes=0-99, 200-299, 400-'],
    ['a suffix range before an int range', 'bytes=-50, 0-99'],
  ])('reports nothing for %s', async (_, range) => {
    expect(await run(range)).toEqual([]);
  });

  it('reports a violation for descending ranges', async () => {
    const [result] = await run('bytes=500-999, 0-99');

    expect(result?.violation?.message).toContain(
      'Range 0-99 appears after 500-999',
    );
  });

  it('reports a violation when an open-ended range comes before an earlier one', async () => {
    const [result] = await run('bytes=500-, 0-99');

    expect(result?.violation?.message).toContain(
      'Range 0-99 appears after 500-',
    );
  });

  it('orders the int ranges around a suffix range', async () => {
    const [result] = await run('bytes=200-299, -50, 0-99');

    expect(result?.violation?.message).toContain(
      'Range 0-99 appears after 200-299',
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
