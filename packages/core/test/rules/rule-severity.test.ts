import { describe, expect, it } from 'vitest';

import {
  compareRuleSeverities,
  type RuleSeverity,
} from '../../src/rules/rule-severity.js';

const order: RuleSeverity[] = ['off', 'hint', 'warn', 'error'];

const orderedPairs = order.flatMap((below, i) =>
  order.slice(i + 1).map((above) => [below, above] as const),
);

describe('compareRuleSeverities', () => {
  it.each(orderedPairs)('orders %s below %s', (below, above) => {
    expect(compareRuleSeverities(below, above)).toBeLessThan(0);
    expect(compareRuleSeverities(above, below)).toBeGreaterThan(0);
  });

  it.each(order)('compares %s equal to itself', (severity) => {
    expect(compareRuleSeverities(severity, severity)).toBe(0);
  });

  it('is antisymmetric', () => {
    for (const a of order) {
      for (const b of order) {
        expect(
          Math.sign(compareRuleSeverities(a, b)) +
            Math.sign(compareRuleSeverities(b, a)),
        ).toBe(0);
      }
    }
  });

  it('sorts a shuffled list from off to error', () => {
    const shuffled: RuleSeverity[] = ['warn', 'off', 'error', 'hint'];

    expect(shuffled.sort(compareRuleSeverities)).toEqual([
      'off',
      'hint',
      'warn',
      'error',
    ]);
  });
});
