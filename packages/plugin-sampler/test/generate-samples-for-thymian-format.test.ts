import { rm } from 'node:fs/promises';

import { ThymianEmitter } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateSamplesForThymianFormat } from '../src/generation/generate-samples-for-thymian-format.js';
import { generateTypesForThymianFormat } from '../src/hooks/generate-request-types.js';
import { readSamplesFromDir } from '../src/samples-structure/read-samples-from-dir.js';
import {
  type BaseNode,
  nodeIsType,
} from '../src/samples-structure/samples-tree-structure.js';
import { traverse } from '../src/samples-structure/traverse.js';
import { writeSamplesToDir } from '../src/samples-structure/write-samples-to-dir.js';
import { createTempDir } from './utils.js';

const format = createThymianFormatWithTransactions(20);

function sourceTransactionsOf(tree: BaseNode): string[] {
  const found: string[] = [];

  traverse(tree, null, (node, ctx) => {
    if (nodeIsType(node, 'samples')) {
      found.push(node.meta.sourceTransaction);
    }

    return ctx;
  });

  return found;
}

/**
 * The samples TREE is still what `sampler init` writes (it is removed in story
 * 575.10), so this guards the generate -> write -> read round-trip. The runtime
 * "every transaction resolves a sample" guarantee moved off disk and is covered by
 * `project-samples-for-format.test.ts` / `request-sampler.test.ts`.
 */
describe('generateSamplesForThymianFormat', () => {
  let tempDir!: string;

  beforeEach(async () => {
    tempDir = await createTempDir('generateSamplesForThymianFormat');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('round-trips through the samples tree on disk', async () => {
    const samples = await generateSamplesForThymianFormat(
      format,
      new ThymianEmitter(),
    );

    const generated = await generateTypesForThymianFormat(format);

    await writeSamplesToDir(samples, generated.keyToTransactionId, {
      path: tempDir,
    });

    const readBack = await readSamplesFromDir(tempDir);

    const transactionIds = format
      .getThymianHttpTransactions()
      .map((transaction) => transaction.transactionId);

    expect(sourceTransactionsOf(readBack).sort()).toEqual(
      [...transactionIds].sort(),
    );
  }, 30_000);
});
