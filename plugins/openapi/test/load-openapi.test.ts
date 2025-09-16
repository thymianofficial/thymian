import { join } from 'node:path';

import { NoopLogger } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { loadOpenapi } from '../src/load-openapi.js';

describe('loadOpenapi', () => {
  it('loads, validates and upgrades document with circular reference', async () => {
    expect(
      async () =>
        await loadOpenapi(new NoopLogger(), {
          allowExternalFiles: true,
          fetchExternalRefs: false,
          filePath: join(
            import.meta.dirname,
            'fixtures/circular-reference.yml'
          ),
          serverInfo: {
            port: 8080,
            host: 'localhost',
            basePath: '',
            protocol: 'http',
          },
        })
    ).not.toThrowError();
  });
});
