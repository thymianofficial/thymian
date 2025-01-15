import { describe, it } from 'vitest';
import { Thymian } from '@thymian/core';
import { MockLogger } from './mock.logger.js';
import runnerPlugin from '../src/index.js';

describe('runner plugin', () => {
  it('should emit', async () => {
    const thymian = new Thymian(new MockLogger());

    thymian.register(runnerPlugin, { arg: 4 });

    await thymian.start();
  });
});
