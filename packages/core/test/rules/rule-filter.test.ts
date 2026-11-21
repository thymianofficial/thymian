import { describe, expect, it } from 'vitest';

import { httpRule } from '../../src/rules/rule-builder.js';
import { createRuleFilter } from '../../src/rules/rule-filter.js';
import type { RuleSeverity } from '../../src/rules/rule-severity.js';

function ruleAt(severity: RuleSeverity) {
  return httpRule(`rule-at-${severity}`)
    .severity(severity)
    .type('static')
    .rule(() => [])
    .done();
}

const rules = (['off', 'hint', 'warn', 'error'] as const).map(ruleAt);

function loadedAt(floor: RuleSeverity): RuleSeverity[] {
  const filter = createRuleFilter({ severity: floor, type: ['static'] });
  return rules.filter(filter).map((rule) => rule.meta.severity);
}

describe('createRuleFilter severity floor', () => {
  it.each([
    ['error', ['error']],
    ['warn', ['warn', 'error']],
    ['hint', ['hint', 'warn', 'error']],
  ] as const)('loads the rules at or above a %s floor', (floor, expected) => {
    expect(loadedAt(floor)).toEqual(expected);
  });

  it('loads no rules at an off floor', () => {
    expect(loadedAt('off')).toEqual([]);
  });
});
