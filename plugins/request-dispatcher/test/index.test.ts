import { describe, it } from 'vitest';
import { NoopLogger, Thymian } from '@thymian/core';
import dispatcherPlugin from '../src/index.js';

describe('runner plugin', () => {
  it('should emit', async () => {
    const thymian = new Thymian(new NoopLogger());

    thymian.register(dispatcherPlugin, { arg: 4 });

    await thymian.start();
  });
});
