import { Thymian } from '@thymian/core';
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

    expect(runs).toHaveLength(0);

    await thymian.close();
  });
});
