import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { generateTypeSurface } from '../src/generation/types/generate-type-surface.js';
import { surfaceDiagnostics } from '../src/generation/types/self-check-surface.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';

/**
 * The emitted surface has to type-check **on its own terms**.
 *
 * Every other compile test writes a probe hook and filters diagnostics to that
 * probe — and both the probe and the scaffolded tsconfig set
 * `skipLibCheck: true`, so a defect *inside* the generated `.d.ts` is invisible
 * to all of them. That is precisely how four of them shipped: an intersection
 * that made `request.path` both an object and a string literal, a `method`
 * typed with the wrong casing, and an argument type nobody could satisfy.
 *
 * `surfaceDiagnostics` is the production self-check gate itself — `init`,
 * `sync` and `validate` all run it before handing back a fresh surface — so
 * this test exercises exactly what production enforces, not a copy of it.
 */
describe('the emitted surface', () => {
  function fixture(): TransactionCatalog {
    const format = new ThymianFormat();

    format.addHttpTransaction(
      createHttpRequest({
        method: 'POST',
        path: '/launches',
        mediaType: 'application/json',
        bodyRequired: true,
        body: {
          type: 'object',
          required: ['missionName'],
          properties: { missionName: { type: 'string' } },
        } as never,
      }),
      createHttpResponse({ statusCode: 201, mediaType: 'application/json' }),
      'test-source',
    );
    format.addHttpTransaction(
      createHttpRequest({
        method: 'GET',
        path: '/launches/{id}',
        pathParameters: {
          id: {
            required: true,
            schema: { type: 'string' },
          } as never,
        },
      }),
      createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
      'test-source',
    );

    return TransactionCatalog.fromThymianFormat(format);
  }

  it('type-checks with library checking on', async () => {
    const surface = await generateTypeSurface(fixture());

    expect(await surfaceDiagnostics(surface)).toEqual([]);
  });
});
