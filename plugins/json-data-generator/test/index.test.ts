import { describe, it } from 'vitest';
import { NoopLogger, Thymian } from '@thymian/core';
import { jsonDataGeneratorPlugin } from '../src/index.js';

describe('JSON data generator plugin ', () => {
  it('should work', () => {
    const thymian = new Thymian(new NoopLogger());

    thymian.register(jsonDataGeneratorPlugin);

    thymian.start();
  });
});
