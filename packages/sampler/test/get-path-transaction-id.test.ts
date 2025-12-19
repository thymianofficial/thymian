import { describe, expect, it } from 'vitest';

import { getPathTransactionId } from '../src/samples-structure/get-path-transaction-id.js';
import { readSamplesFromDir } from '../src/samples-structure/read-samples-from-dir.js';
import type { SamplesStructure } from '../src/samples-structure/samples-tree-structure.js';

const mockSamplesStructure: SamplesStructure = {
  type: 'root',
  meta: { version: 'root', timestamp: 0 },
  children: [],
};

function createNode(
  type: string,
  meta: Record<string, unknown>,
  children: unknown[] = [],
) {
  return { type, children, meta };
}

describe('getPathTransactionId', () => {
  it('returns undefined when no matching transaction ID is found', async () => {
    const samples = await readSamplesFromDir(
      '/Users/matthias/Developer/thymian-demo/.thymian/samples',
    );

    const result = await getPathTransactionId(
      'c1f2f3232f0b72482307af18c18fd9705bbe55ed',
      '/Users/matthias/Developer/thymian-demo/.thymian/samples',
      samples,
    );
    console.log(result);
  });
});
