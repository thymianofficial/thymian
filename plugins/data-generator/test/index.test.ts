import { Thymian } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import dataGeneratorPlugin from '../src/index.js';

describe('data generator plugin', () => {
  it('should register correct hook', async () => {
    const thymian = new Thymian().register(dataGeneratorPlugin);

    await thymian.ready();

    const result = await thymian.emitter.runHook('data-generator.generate', {
      contentType: 'application/json',
      schema: {
        type: 'integer',
      },
    });

    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe('number');
  });
});
