import { describe, expect, it } from 'vitest';
import { NoopLogger, Thymian } from '@thymian/core';
import { openApiPlugin } from '../src/index.js';

describe('OpenApi plugin', () => {
  it('loads openapi v3 document', async () => {
    const thymian = new Thymian(new NoopLogger());

    await thymian.register(openApiPlugin).loadRegisteredPlugins();

    const formats = await thymian.emitter.runHook('openapi.load', {
      filePath: './test/fixtures/petstore-v3.yaml',
    });

    console.log(JSON.stringify(formats));

    expect(formats).toHaveLength(1);
  });
});
