import { Thymian, ThymianFormat } from '@thymian/core';
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
});
