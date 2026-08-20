import { rm } from 'node:fs/promises';

import { ThymianEmitter } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateSamplesForThymianFormat } from '../src/generation/generate-samples-for-thymian-format.js';
import { generateTypesForThymianFormat } from '../src/hooks/generate-request-types.js';
import type { HttpRequestSample } from '../src/http-request-sample.js';
import { readSamplesFromDir } from '../src/samples-structure/read-samples-from-dir.js';
import {
  type BaseNode,
  nodeIsType,
} from '../src/samples-structure/samples-tree-structure.js';
import { traverse } from '../src/samples-structure/traverse.js';
import { writeSamplesToDir } from '../src/samples-structure/write-samples-to-dir.js';
import { createTempDir } from './utils.js';

const format = createThymianFormatWithTransactions(20);

type RoundTrippedSamples = {
  sourceTransaction: string;
  requests: HttpRequestSample[];
};

/**
 * Collects every samples node together with the request payloads that came back
 * out of its `requests/` directory. `read-samples-from-dir` builds the samples
 * node from `meta.json` alone, so collecting only `meta.sourceTransaction` would
 * pass even against a write path that emitted empty or garbled `*-request.json`
 * files — the payloads are what make this a real round-trip.
 */
function roundTrippedSamplesOf(tree: BaseNode): RoundTrippedSamples[] {
  const found: RoundTrippedSamples[] = [];

  traverse(tree, null, (node, ctx) => {
    if (nodeIsType(node, 'samples')) {
      found.push({
        sourceTransaction: node.meta.sourceTransaction,
        requests: node.children.flatMap((child) => child.value),
      });
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

    const expectedByTransactionId = new Map(
      format.getThymianHttpTransactions().map((transaction) => [
        transaction.transactionId,
        {
          method: transaction.thymianReq.method,
          path: transaction.thymianReq.path,
        },
      ]),
    );

    const roundTripped = roundTrippedSamplesOf(readBack);

    expect(
      roundTripped.map((samples) => samples.sourceTransaction).sort(),
    ).toEqual([...expectedByTransactionId.keys()].sort());

    // The payload half: exactly one request per samples node, and it is the one
    // generated for THAT transaction. This is what the docstring's "generate ->
    // write -> read round-trip" claim rests on — `meta.sourceTransaction` alone
    // never leaves the `meta.json` written beside `requests/`.
    for (const { sourceTransaction, requests } of roundTripped) {
      const expected = expectedByTransactionId.get(sourceTransaction);

      expect(expected).toBeDefined();
      expect(
        requests.map((request) => ({
          method: request.method,
          path: request.path,
        })),
      ).toEqual([expected]);
    }
  }, 30_000);
});
