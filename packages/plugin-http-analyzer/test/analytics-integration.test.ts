import { httpRule, Thymian, ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import httpAnalyzerPlugin from '../src/index.js';

describe('plugin-http-analyzer integration', () => {
  it('returns tool runs from core.analyze', async () => {
    const thymian = new Thymian();
    await thymian.register(httpAnalyzerPlugin, {}).ready();

    const runs = await thymian.emitter.emitAction(
      'core.analyze',
      {
        rules: [],
        rulesConfig: {},
        traffic: { transactions: [], traces: [] },
      },
      { strategy: 'first' },
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]?.tool.name).toBe('@thymian/plugin-http-analyzer');
    // No rules or transactions → a single placeholder "analyze" execution.
    expect(runs[0]?.executions).toHaveLength(0);
    expect(runs[0]?.rules).toBeUndefined();
    // No `format` was passed, so the plugin falls back to an empty
    // ThymianFormat — its `thymianFormatVersion` must still be set to that
    // format's hash rather than left `undefined`.
    expect(runs[0]?.thymianFormatVersion).toBe(new ThymianFormat().toHash());

    await thymian.close();
  });

  it('populates ToolRun.rules from the executed rules', async () => {
    const thymian = new Thymian();
    await thymian.register(httpAnalyzerPlugin, {}).ready();

    const rule = httpRule('test/analyzer-rule')
      .severity('error')
      .type('analytics')
      .rule(() => [
        {
          location: 'example',
          violation: { message: 'violation' },
          findings: [],
        },
      ])
      .done();

    const runs = await thymian.emitter.emitAction(
      'core.analyze',
      {
        rules: [rule],
        rulesConfig: {},
        traffic: { transactions: [], traces: [] },
      },
      { strategy: 'first' },
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]?.rules).toEqual([
      { id: 'test/analyzer-rule', severity: 'error' },
    ]);

    await thymian.close();
  });
});
