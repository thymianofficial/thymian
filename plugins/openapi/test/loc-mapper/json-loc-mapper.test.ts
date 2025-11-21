import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { JsonLocMapper } from '../../src/loc-mapper/json-loc-mapper.js';

describe('JSON LOC Mapper', async () => {
  const openapiPath = join(
    import.meta.dirname,
    '../fixtures/simple-openapi-v3_1.json',
  );
  const openapi = await readFile(openapiPath, 'utf-8');

  it('should map location', () => {
    const mapper = new JsonLocMapper(openapi, openapiPath);

    const location = mapper.locationForOperationId('getHello');

    expect(location).toMatchObject({
      path: openapiPath,
      position: {
        line: 9,
        column: 7,
        offset: 73,
      },
    });

    console.log(location);
  });
});
