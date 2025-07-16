import { NoopLogger, Thymian, ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { openApiPlugin } from '../src/index.js';

describe('OpenApi plugin', () => {
  it('loads openapi v3 document', async () => {
    const thymian = new Thymian(new NoopLogger());

    await thymian
      .register(openApiPlugin, {
        filePath: '../../shared/test-utils/src/fixtures/petstore-v2.yaml',
      })
      .ready();

    const formats = await thymian.emitter.emitAction('core.load-format');

    expect(formats).toHaveLength(1);

    console.log(JSON.stringify(ThymianFormat.import(formats[0]!).graph));
  });
});
