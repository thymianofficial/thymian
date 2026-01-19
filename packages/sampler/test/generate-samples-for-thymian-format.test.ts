import { rm } from 'node:fs/promises';

import { ThymianEmitter } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateSamplesForThymianFormat } from '../src/generation/generate-samples-for-thymian-format.js';
import { generateTypesForThymianFormat } from '../src/hooks/generate-request-types.js';
import { RequestSampler } from '../src/request-sampler.js';
import { writeSamplesToDir } from '../src/samples-structure/write-samples-to-dir.js';
import { createTempDir } from './utils.js';

const format = createThymianFormatWithTransactions(20);

describe('generateSamplesForThymianFormat', () => {
  let tempDir!: string;

  beforeEach(async () => {
    tempDir = await createTempDir('generateSamplesForThymianFormat');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should work', async () => {
    const samples = await generateSamplesForThymianFormat(
      format,
      new ThymianEmitter(),
    );

    const generated = await generateTypesForThymianFormat(format);

    await writeSamplesToDir(samples, generated.keyToTransactionId, {
      path: tempDir,
    });

    const sampler = new RequestSampler(tempDir);

    await sampler.init();

    for (const transaction of format.getThymianHttpTransactions()) {
      const sample = sampler.sampleForTransaction(transaction.transactionId);
      expect(sample).toBeDefined();
    }
  });
});
