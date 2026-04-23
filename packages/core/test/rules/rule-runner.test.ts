import { describe, expect, it } from 'vitest';

import type { Rule, RuleFnResult } from '../../src/index.js';
import { NoopLogger, runRules, ThymianFormat } from '../../src/index.js';

class TestRuleContext {
  constructor(private readonly diagnostics?: { detail: string }) {}

  getRuleExecutionDiagnostics(): { detail: string } | undefined {
    return this.diagnostics;
  }
}

describe('runRules', () => {
  it('should collect diagnostics by rule name', async () => {
    const diagnosticsByRuleName = {
      'rule-with-diagnostics': { detail: 'captured diagnostics' },
    };

    const rules: Rule[] = [
      {
        meta: {
          name: 'rule-with-diagnostics',
          type: ['test'],
          options: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
          severity: 'warn',
        },
        testRule: () => [] as RuleFnResult,
      },
      {
        meta: {
          name: 'rule-without-diagnostics',
          type: ['test'],
          options: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
          severity: 'hint',
        },
        testRule: () => [] as RuleFnResult,
      },
    ];

    const result = await runRules<TestRuleContext, { detail: string }>(
      new NoopLogger(),
      rules,
      new ThymianFormat(),
      {},
      {
        errorName: 'TestRuleRunnerError',
        mode: 'test',
        getRuleFn: (rule) => rule.testRule,
        createContext: (rule) =>
          new TestRuleContext(
            diagnosticsByRuleName[
              rule.meta.name as keyof typeof diagnosticsByRuleName
            ],
          ),
      },
    );

    expect(result.diagnosticsByRule).toEqual({
      'rule-with-diagnostics': { detail: 'captured diagnostics' },
    });
  });
});
