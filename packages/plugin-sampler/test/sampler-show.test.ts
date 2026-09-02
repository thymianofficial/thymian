import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { type SamplerHarness, startSampler } from './plugin-harness.js';
import { listTree } from './utils.js';

/**
 * #9: `sampler show <selector>` is the user-facing surface of the catalog — a
 * user addresses exactly one Transaction and sees the request that will be sent,
 * without anything being materialized.
 */
describe('sampler show', () => {
  const harnesses: SamplerHarness[] = [];

  async function sampler(): Promise<SamplerHarness> {
    const harness = await startSampler();
    harnesses.push(harness);
    return harness;
  }

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  const format = createThymianFormatWithTransactions([
    [
      createHttpRequest({ method: 'GET', path: '/launches' }),
      createHttpResponse(),
    ],
    [
      createHttpRequest({
        method: 'POST',
        path: '/astronauts',
        mediaType: 'application/json',
      }),
      createHttpResponse({ statusCode: 201 }),
    ],
  ]);

  it('prints the freshly generated request for a selector', async () => {
    const harness = await sampler();
    await harness.loadFormat(format);

    const shown = await harness.show(
      'POST /astronauts (application/json) -> 201 (application/json)',
    );

    expect(shown.selector).toBe(
      'POST /astronauts (application/json) -> 201 (application/json)',
    );
    expect(shown.request.method).toBe('POST');
    expect(shown.request.path).toBe('/astronauts');
    // The response declares a media type, so the request asks for it.
    expect(shown.request.headers['accept']).toBe('application/json');
  });

  it('materializes nothing to show a request', async () => {
    const harness = await sampler();
    await harness.loadFormat(format);

    await harness.show('GET /launches -> 200 (application/json)');

    await expect(listTree(harness.cwd)).resolves.toEqual([]);
  });

  it('answers an unknown selector with nearest matches', async () => {
    const harness = await sampler();
    await harness.loadFormat(format);

    await expect(
      harness.show('GET /launches -> 404 (application/json)'),
    ).rejects.toThrowError(/No transaction matches the selector/);
  });

  it('answers a malformed selector with the grammar', async () => {
    const harness = await sampler();
    await harness.loadFormat(format);

    await expect(harness.show('GET /launches')).rejects.toThrowError(
      /is not a valid transaction selector/,
    );
  });
});
