import { join } from 'node:path';

import { NoopLogger, Thymian, ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { openApiPlugin } from '../src/index.js';

describe('OpenApi plugin', () => {
  it('loads openapi v3 document', async () => {
    const thymian = new Thymian(new NoopLogger(), {
      cwd: join(import.meta.dirname, '../..'),
    });

    await thymian
      .register(openApiPlugin, {
        descriptions: [
          {
            source: 'test-utils/src/fixtures/petstore-v2.yaml',
          },
        ],
      })
      .ready();

    const formats = await thymian.emitter.emitAction('core.load-format');

    expect(formats).toHaveLength(1);
  });

  it('loads and transforms openapi document from file via transform action', async () => {
    const thymian = new Thymian(new NoopLogger());

    await thymian.register(openApiPlugin).ready();

    const format = ThymianFormat.import(
      await thymian.emitter.emitAction(
        'openapi.transform',
        {
          content: join(import.meta.dirname, 'fixtures/simple-swagger.json'),
        },
        { strategy: 'first' },
      ),
    );

    expect(format.graph.size).toBe(1); // edges
    expect(format.graph.order).toBe(2); // nodes
  });
});
