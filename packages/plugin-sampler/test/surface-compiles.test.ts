import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  generateTypeSurface,
  HOOKS_API_FILE,
  REQUEST_TYPES_FILE,
} from '../src/generation/types/generate-type-surface.js';
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
 * So this test compiles the two emitted files with `skipLibCheck: false` and
 * asserts there is nothing to say about them.
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
    const root = await mkdtemp(join(tmpdir(), 'thymian-surface-'));

    try {
      const generated = join(root, 'generated');
      const surface = await generateTypeSurface(fixture());

      await mkdir(generated, { recursive: true });
      await writeFile(
        join(generated, REQUEST_TYPES_FILE),
        surface.requestTypes,
        'utf-8',
      );
      await writeFile(
        join(generated, HOOKS_API_FILE),
        surface.hooksApi,
        'utf-8',
      );

      const program = ts.createProgram(
        [join(generated, HOOKS_API_FILE), join(generated, REQUEST_TYPES_FILE)],
        {
          strict: true,
          noEmit: true,
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          target: ts.ScriptTarget.ES2023,
          // The whole point: do not skip the files under test.
          skipLibCheck: false,
          lib: ['lib.es2023.d.ts'],
          types: [],
        },
      );

      const diagnostics = ts.getPreEmitDiagnostics(program).map((d) => ({
        file: d.file?.fileName.replace(`${generated}/`, '') ?? '(no file)',
        message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
      }));

      expect(diagnostics).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
