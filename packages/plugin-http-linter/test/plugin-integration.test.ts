import { Thymian, ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import httpLinterPlugin from '../src/index.js';

describe('plugin-http-linter integration', () => {
  it('returns tool runs from core.lint', async () => {
    const thymian = new Thymian();
    await thymian.register(httpLinterPlugin, {}).ready();

    const format = new ThymianFormat();
    const runs = await thymian.emitter.emitAction(
      'core.lint',
      {
        format: format.export(),
        rules: [],
        rulesConfig: {},
      },
      { strategy: 'first' },
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]?.tool.name).toBe('@thymian/plugin-http-linter');
    expect(runs[0]?.executions).toHaveLength(0);
    // `thymianFormatVersion` must match the hash `finalizeWorkflow` uses to key
    // `report.thymianFormat`, or the reporter can never resolve locations.
    expect(runs[0]?.thymianFormatVersion).toBe(format.toHash());

    await thymian.close();
  });
});
