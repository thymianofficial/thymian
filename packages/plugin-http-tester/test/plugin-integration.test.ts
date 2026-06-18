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

    expect(runs).toHaveLength(0);

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

    await thymian.close();
  });
});
