import { Thymian } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import dataGeneratorPlugin from '../src/index.js';

describe('data generator plugin', () => {
  it('should register correct hook', async () => {
    const thymian = new Thymian().register(dataGeneratorPlugin);

    await thymian.ready();

    const result = await thymian.emitter.runHook('sampler.generate', {
      contentType: 'application/json',
      schema: {
        type: 'integer',
      },
    });

    console.log(result);

    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBeTypeOf('number');
  });
});
