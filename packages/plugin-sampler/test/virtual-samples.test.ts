import { ThymianFormat } from '@thymian/core';
import {
  createGetRequest,
  createHttpResponse,
  createOkResponse,
  createPostRequest,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { type SamplerHarness, startSampler } from './plugin-harness.js';
import { bytes, listTree } from './utils.js';

/**
 * Spec §1 / #8: samples are a deterministic in-memory projection of the loaded
 * format. Nothing is read from or written to disk as canonical runtime state,
 * so no spec edit can leave a stale artifact behind.
 */
describe('virtual samples', () => {
  const harnesses: SamplerHarness[] = [];

  async function sampler(): Promise<SamplerHarness> {
    const harness = await startSampler();
    harnesses.push(harness);
    return harness;
  }

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  it('serves a sample for every transaction with nothing on disk', async () => {
    const format = createThymianFormatWithTransactions([
      [createGetRequest({ path: '/launches' }), createOkResponse()],
      [
        createPostRequest({ path: '/astronauts' }),
        createHttpResponse({ statusCode: 201 }),
      ],
    ]);
    const harness = await sampler();

    await harness.loadFormat(format);

    const samples = await harness.sampleAll(format);

    expect(samples).toHaveLength(2);
    for (const sample of samples) {
      expect(sample.method).toBeTypeOf('string');
      expect(sample.path).toBeTypeOf('string');
    }
  });

  it('writes nothing to the working directory', async () => {
    const format = createThymianFormatWithTransactions(5);
    const harness = await sampler();

    await harness.loadFormat(format);
    await harness.sampleAll(format);

    await expect(listTree(harness.cwd)).resolves.toEqual([]);
  });

  it('answers a transaction the projection never saw, rather than failing', async () => {
    // A transaction reaching `core.request.sample` from outside the loaded
    // format used to raise TransactionSampleNotFoundError / VersionMismatchError.
    // Generation is a pure function of the transaction, so there is nothing to
    // be out of sync with and nothing to report.
    const loaded = createThymianFormatWithTransactions(1);
    const other = createThymianFormatWithTransactions([
      [createGetRequest({ path: '/unseen' }), createOkResponse()],
    ]);
    const harness = await sampler();

    await harness.loadFormat(loaded);

    const [transaction] = other.getThymianHttpTransactions();
    if (!transaction) {
      throw new Error('fixture has no transaction');
    }
    const sample = await harness.sample(transaction.transactionId, other);

    expect(sample.path).toBe('/unseen');
  });

  it('is byte-identical across repeated runs', async () => {
    const format = createThymianFormatWithTransactions(8);
    const first = await sampler();
    const second = await sampler();

    await first.loadFormat(format);
    await second.loadFormat(format);

    expect(bytes(await first.sampleAll(format))).toBe(
      bytes(await second.sampleAll(format)),
    );
  });

  it('is byte-identical across a format export/import round trip', async () => {
    const format = createThymianFormatWithTransactions(8);
    const roundTripped = ThymianFormat.import(format.export());
    const direct = await sampler();
    const viaRoundTrip = await sampler();

    await direct.loadFormat(format);
    await viaRoundTrip.loadFormat(roundTripped);

    expect(bytes(await viaRoundTrip.sampleAll(roundTripped))).toBe(
      bytes(await direct.sampleAll(format)),
    );
  });

  it('reprojects when a new format is loaded, so an edit cannot go stale', async () => {
    const before = createThymianFormatWithTransactions([
      [createGetRequest({ path: '/launches' }), createOkResponse()],
    ]);
    const after = createThymianFormatWithTransactions([
      [createGetRequest({ path: '/renamed' }), createOkResponse()],
    ]);
    const harness = await sampler();

    await harness.loadFormat(before);
    await harness.loadFormat(after);

    const [transaction] = after.getThymianHttpTransactions();
    if (!transaction) {
      throw new Error('fixture has no transaction');
    }
    const sample = await harness.sample(transaction.transactionId, after);

    expect(sample.path).toBe('/renamed');
  });
});
