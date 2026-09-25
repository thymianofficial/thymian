import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TypeSurface } from '../src/generation/types/generate-type-surface.js';
import {
  selfCheckSurface,
  surfaceDiagnostics,
} from '../src/generation/types/self-check-surface.js';
import { startSampler } from './plugin-harness.js';

/** A surface with no diagnostics to report. */
const CLEAN: TypeSurface = {
  requestTypes: 'export type Fine = string;\n',
  hooksApi: 'export type AlsoFine = number;\n',
};

/** A surface `tsc` cannot make sense of — the shape a real emitter bug would leave behind. */
const BROKEN: TypeSurface = {
  requestTypes:
    'export interface Duplicate { a: string; }\nexport interface Duplicate { a: number; }\n',
  hooksApi: '',
};

describe('the generation self-check gate', () => {
  describe('surfaceDiagnostics', () => {
    it('reports nothing for a surface that compiles on its own', async () => {
      expect(await surfaceDiagnostics(CLEAN)).toEqual([]);
    });

    it('reports every diagnostic tsc has about a broken surface', async () => {
      const diagnostics = await surfaceDiagnostics(BROKEN);

      expect(diagnostics.length).toBeGreaterThan(0);
      // Anchored to the file and line the compiler actually complained about,
      // not a paraphrase of it.
      expect(diagnostics[0]).toMatch(/^request-types\.d\.ts:\d+ TS\d+: /);
    });
  });

  describe('selfCheckSurface', () => {
    it('resolves silently for a surface that compiles', async () => {
      await expect(selfCheckSurface(CLEAN)).resolves.toBeUndefined();
    });

    it('fails loudly, attributed to the generator, for a surface that does not compile', async () => {
      await expect(selfCheckSurface(BROKEN)).rejects.toMatchObject({
        name: 'GeneratedSurfaceError',
        // Names the generator's own defect as the fault, and says in the same
        // breath that the API description and the hooks are not it — the
        // distinction the ticket exists to draw.
        message: expect.stringMatching(
          /defect in the sampler's own generator.*not your API description or your hooks/,
        ),
      });
    });

    it('carries every tsc diagnostic as a suggestion, so the report names the fault', async () => {
      await expect(selfCheckSurface(BROKEN)).rejects.toMatchObject({
        options: {
          suggestions: expect.arrayContaining([
            expect.stringMatching(/^request-types\.d\.ts/),
          ]),
        },
      });
    });
  });
});

/**
 * The gate wired into every place a fresh surface is produced: `init`,
 * `sync` and `validate`'s scratch surface. Each is driven through the plugin
 * event seam exactly as the CLI commands drive it, with `generateTypeSurface`
 * itself swapped for one that always hands back {@link BROKEN} — the cheapest
 * reliable way to prove the wiring without depending on a real emitter defect
 * (the known ones are #137's fixtures, deliberately out of this gate's test
 * corpus).
 */
vi.mock(
  '../src/generation/types/generate-type-surface.js',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../src/generation/types/generate-type-surface.js')
      >();

    return {
      ...actual,
      generateTypeSurface: async () => BROKEN,
    };
  },
);

describe('the self-check gate, wired into every generation seam', () => {
  const FIXTURE = createThymianFormatWithTransactions([
    [
      createHttpRequest({ method: 'GET', path: '/launches' }),
      createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
    ],
  ]);

  const harnesses: Array<{ dispose(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  async function sampler() {
    const harness = await startSampler();

    harnesses.push(harness);

    return harness;
  }

  it('aborts sampler init', async () => {
    const harness = await sampler();

    await harness.loadFormat(FIXTURE);

    await expect(harness.init()).rejects.toMatchObject({
      name: 'GeneratedSurfaceError',
    });
  });

  it('aborts sampler sync, in both write and --check mode', async () => {
    const harness = await sampler();

    await harness.loadFormat(FIXTURE);

    await expect(harness.sync()).rejects.toMatchObject({
      name: 'GeneratedSurfaceError',
    });
    await expect(harness.sync(true)).rejects.toMatchObject({
      name: 'GeneratedSurfaceError',
    });
  });

  it('aborts sampler validate', async () => {
    const harness = await sampler();

    await harness.loadFormat(FIXTURE);

    await expect(harness.validate()).rejects.toMatchObject({
      name: 'GeneratedSurfaceError',
    });
  });
});
