import { httpRule, Thymian, ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import httpTesterPlugin from '../src/index.js';

describe('plugin-http-tester integration', () => {
  it('returns tool runs from core.test', async () => {
    const thymian = new Thymian();
    await thymian.register(httpTesterPlugin, {}).ready();

    const runs = await thymian.emitter.emitAction(
      'core.test',
      {
        format: new ThymianFormat().export(),
        rules: [],
        rulesConfig: {},
      },
      { strategy: 'first' },
    );

    // With no rules, createRuns still returns one ToolRun with empty executions.
    expect(runs).toHaveLength(1);
    expect(runs[0]?.executions).toHaveLength(0);

    await thymian.close();
  });

  it('populates ToolRun.rules from the executed rules', async () => {
    const thymian = new Thymian();
    await thymian.register(httpTesterPlugin, {}).ready();

    const rule = httpRule('test/example-rule')
      .severity('warn')
      .type('test')
      .summary('Example rule summary')
      .rule(() => [
        {
          location: 'example',
          violation: { message: 'violation' },
          findings: [],
        },
      ])
      .done();

    const runs = await thymian.emitter.emitAction(
      'core.test',
      {
        format: new ThymianFormat().export(),
        rules: [rule],
        rulesConfig: {},
      },
      { strategy: 'first' },
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]?.rules).toEqual([
      {
        id: 'test/example-rule',
        severity: 'warn',
        // done() mirrors a lone summary into description
        description: { text: 'Example rule summary' },
        summary: { text: 'Example rule summary' },
      },
    ]);

    // Execution tree: one parent per rule, one child per RuleFnResult entry.
    expect(runs[0]?.executions).toHaveLength(1);
    const parent = runs[0]!.executions[0]!;
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]!.findings).toEqual([
      expect.objectContaining({
        kind: 'rule-violation',
        ruleId: 'test/example-rule',
        severity: 'warn',
      }),
    ]);

    await thymian.close();
  });
});
