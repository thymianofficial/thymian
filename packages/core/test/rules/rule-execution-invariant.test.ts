import { describe, expect, it } from 'vitest';

import type { Rule } from '../../src/rules/rule.js';
import {
  checkRuleExecutionInvariant,
  checkRuleTypeDeclaration,
  describeRuleExecutionInvariantViolation,
} from '../../src/rules/rule-execution-invariant.js';
import type { RuleMeta } from '../../src/rules/rule-meta.js';

function makeRule(
  overrides: Partial<Rule> & { meta?: Partial<RuleMeta> },
): Rule {
  const { meta, ...rest } = overrides;

  return {
    meta: {
      name: 'test-rule',
      severity: 'error',
      type: ['static'],
      tags: [],
      options: {},
      ...meta,
    } as RuleMeta,
    ...rest,
  };
}

describe('checkRuleTypeDeclaration', () => {
  it('flags a missing type declaration', () => {
    const rule = makeRule({});
    delete (rule.meta as Partial<RuleMeta>).type;

    expect(checkRuleTypeDeclaration(rule)).toEqual({
      reason: 'invalid-type-declaration',
    });
  });

  it('flags a non-array type declaration', () => {
    const rule = makeRule({});
    (rule.meta as Record<string, unknown>).type = 'static';

    expect(checkRuleTypeDeclaration(rule)).toEqual({
      reason: 'invalid-type-declaration',
    });
  });

  it('flags an empty type array', () => {
    expect(checkRuleTypeDeclaration(makeRule({ meta: { type: [] } }))).toEqual({
      reason: 'invalid-type-declaration',
    });
  });

  it('flags unknown rule types', () => {
    const rule = makeRule({});
    (rule.meta as Record<string, unknown>).type = ['static', 'staticc'];

    expect(checkRuleTypeDeclaration(rule)).toEqual({
      reason: 'unknown-rule-types',
      unknownTypes: ['staticc'],
    });
  });

  it('accepts a valid declaration', () => {
    expect(
      checkRuleTypeDeclaration(makeRule({ meta: { type: ['static'] } })),
    ).toBeUndefined();
  });
});

describe('checkRuleExecutionInvariant', () => {
  it('reports declaration violations first', () => {
    expect(
      checkRuleExecutionInvariant(makeRule({ meta: { type: [] } })),
    ).toEqual({ reason: 'invalid-type-declaration' });
  });

  it('flags informational mixed with executable types', () => {
    expect(
      checkRuleExecutionInvariant(
        makeRule({ meta: { type: ['informational', 'static'] } }),
      ),
    ).toEqual({ reason: 'informational-mixed-with-executable-types' });
  });

  it('flags an informational rule with an execution function', () => {
    expect(
      checkRuleExecutionInvariant(
        makeRule({ meta: { type: ['informational'] }, lintRule: () => [] }),
      ),
    ).toEqual({ reason: 'informational-rule-with-execution-function' });
  });

  it('accepts an informational rule without execution functions', () => {
    expect(
      checkRuleExecutionInvariant(
        makeRule({ meta: { type: ['informational'] } }),
      ),
    ).toBeUndefined();
  });

  it('flags every executable type without its execution function', () => {
    expect(
      checkRuleExecutionInvariant(
        makeRule({
          meta: { type: ['static', 'analytics', 'test'] },
          lintRule: () => [],
        }),
      ),
    ).toEqual({
      reason: 'missing-execution-function',
      missingTypes: ['analytics', 'test'],
    });
  });

  it('accepts a fully covered executable rule', () => {
    expect(
      checkRuleExecutionInvariant(
        makeRule({
          meta: { type: ['static', 'test'] },
          lintRule: () => [],
          testRule: () => [],
        }),
      ),
    ).toBeUndefined();
  });
});

describe('describeRuleExecutionInvariantViolation', () => {
  it('produces a message and suggestions for every reason', () => {
    const violations = [
      { reason: 'invalid-type-declaration' },
      { reason: 'unknown-rule-types', unknownTypes: ['staticc'] },
      { reason: 'informational-mixed-with-executable-types' },
      { reason: 'informational-rule-with-execution-function' },
      { reason: 'missing-execution-function', missingTypes: ['static'] },
    ] as const;

    for (const violation of violations) {
      const { message, suggestions } = describeRuleExecutionInvariantViolation(
        'test-rule',
        violation,
      );

      expect(message).toContain('test-rule');
      expect(suggestions.length).toBeGreaterThan(0);
    }
  });
});
