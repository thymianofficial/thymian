import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { canonicalize } from '../src/validation/canonicalize.js';
import { type SamplerHarness, startSampler } from './plugin-harness.js';

/**
 * #16: committed types are the staleness baseline. `sync` accepts a new
 * surface, `--check` is the CI gate, and `validate` separates "you have not run
 * sync" from "your hooks no longer fit the description".
 */
describe('the drift gate', () => {
  const harnesses: SamplerHarness[] = [];

  async function sampler(): Promise<SamplerHarness> {
    const harness = await startSampler();
    harnesses.push(harness);
    return harness;
  }

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  function formatOf(
    pairs: Array<{
      method: string;
      path: string;
      status: number;
      description?: string;
    }>,
  ): ThymianFormat {
    const format = new ThymianFormat();

    for (const pair of pairs) {
      format.addHttpTransaction(
        createHttpRequest({
          method: pair.method,
          path: pair.path,
          description: pair.description,
        }),
        createHttpResponse({
          statusCode: pair.status,
          mediaType: 'application/json',
          description: pair.description,
          schema: {
            type: 'object',
            properties: {
              // A *schema property* description is the one that reaches the
              // emitted bytes, as JSDoc. An operation description does not, so
              // testing only that would exercise nothing. It goes on the
              // response so the request's Selector keeps its shape.
              name: { type: 'string', description: pair.description },
            },
          } as never,
        }),
        'test-source',
      );
    }

    return format;
  }

  const BASE = [
    { method: 'GET', path: '/launches', status: 200 },
    { method: 'GET', path: '/astronauts', status: 200 },
  ];

  const LAUNCHES = 'GET /launches -> 200 (application/json)';

  describe('sync', () => {
    it('reports nothing to do once the committed types match', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));
      await harness.init();

      await expect(harness.sync(true)).resolves.toEqual({
        changed: [],
        wrote: false,
      });
    });

    it('--check writes nothing, even when everything is missing', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));

      const result = await harness.sync(true);

      expect(result.wrote).toBe(false);
      expect(result.changed).toEqual(['hooks-api.d.ts', 'request-types.d.ts']);
      // A gate that fixed what it checks would pass the second time for the
      // wrong reason.
      await expect(harness.sync(true)).resolves.toEqual(result);
    });

    it('regenerates, and never touches the tsconfig', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));
      await harness.init();

      const tsconfigPath = join(
        harness.cwd,
        '.thymian',
        'sampler',
        'tsconfig.json',
      );
      const edited = '{ "compilerOptions": { "strict": false } }\n';

      await writeFile(tsconfigPath, edited, 'utf-8');
      await harness.loadFormat(
        formatOf([...BASE, { method: 'GET', path: '/rockets', status: 200 }]),
      );

      const result = await harness.sync();

      expect(result.wrote).toBe(true);
      expect(result.changed).toEqual(['request-types.d.ts']);
      await expect(readFile(tsconfigPath, 'utf-8')).resolves.toBe(edited);
      await expect(harness.sync(true)).resolves.toMatchObject({ changed: [] });
    });
  });

  describe('what counts as drift', () => {
    it('a description-only edit does not', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));
      await harness.init();

      const path = join(
        harness.cwd,
        '.thymian',
        'sampler',
        'generated',
        'request-types.d.ts',
      );
      const before = await readFile(path, 'utf-8');

      await harness.loadFormat(
        formatOf(BASE.map((p) => ({ ...p, description: 'Rewritten.' }))),
      );

      // The bytes really do move — the description becomes JSDoc — so this is
      // the canonicalization working, not a vacuous comparison.
      const rewritten = await harness.sync();

      expect(rewritten.rewritten).toEqual(['request-types.d.ts']);
      expect(rewritten.changed).toEqual([]);
      expect(await readFile(path, 'utf-8')).not.toBe(before);

      await expect(harness.sync(true)).resolves.toMatchObject({ changed: [] });
      await expect(harness.validate()).resolves.toMatchObject({
        surface: 'in-sync',
        verdict: 'ok',
      });
    });

    it('a pure reordering of the document does not', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));
      await harness.init();
      await harness.loadFormat(formatOf([...BASE].reverse()));

      await expect(harness.sync(true)).resolves.toMatchObject({ changed: [] });
    });

    it('reformatting the committed file does not', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));
      await harness.init();

      const path = join(
        harness.cwd,
        '.thymian',
        'sampler',
        'generated',
        'request-types.d.ts',
      );
      const committed = await readFile(path, 'utf-8');

      // Comments gone, whitespace collapsed: the same types, said differently.
      await writeFile(path, canonicalize(committed), 'utf-8');

      await expect(harness.sync(true)).resolves.toMatchObject({ changed: [] });
    });

    it('an added status does, without breaking a hook', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));
      await harness.init();
      await harness.writeHook(
        'hook.ts',
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${JSON.stringify(LAUNCHES)}, () => {});
`,
      );
      await harness.loadFormat(
        formatOf([...BASE, { method: 'GET', path: '/launches', status: 503 }]),
      );

      await expect(harness.validate()).resolves.toMatchObject({
        surface: 'behind',
        changedFiles: ['request-types.d.ts'],
        verdict: 'stale',
      });
    });
  });

  describe('validate', () => {
    it('is silent when nothing is committed and every hook resolves', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'hook.ts',
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${JSON.stringify(LAUNCHES)}, () => {});
`,
      );
      await harness.loadFormat(formatOf(BASE));

      await expect(harness.validate()).resolves.toMatchObject({
        surface: 'absent',
        verdict: 'ok',
        typeErrors: [],
      });
    });

    it('calls a removed operation breaking drift, at the hook’s own line', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'hook.ts',
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(
  ${JSON.stringify(LAUNCHES)},
  () => {},
);
`,
      );
      await harness.loadFormat(formatOf(BASE));
      await harness.init();
      // The operation the hook is anchored to is gone.
      await harness.loadFormat(
        formatOf([{ method: 'GET', path: '/astronauts', status: 200 }]),
      );

      const report = await harness.validate();

      // The surface moved *and* the hook stopped fitting, which is drift
      // proper — `sync` is part of the remedy here, unlike a plain hook error.
      expect(report.verdict).toBe('drifted');
      expect(report.unresolved[0]?.file).toBe('hook.ts');
      expect(report.typeErrors[0]).toMatchObject({
        file: join('hooks', 'hook.ts'),
        line: 4,
      });
    });

    it('calls a hook that will not compile broken, not drifted', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'wrong.ts',
        `import { beforeEach } from '@thymian/hooks';

export const wrong = beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
  const n: number = request.headers['accept'];
  void n;
});
`,
      );
      await harness.loadFormat(formatOf(BASE));
      await harness.init();

      const report = await harness.validate();

      // Nothing drifted — the committed types match the description exactly.
      // Announcing drift here sent the reader after a `sync` that would
      // rewrite correct files and leave the real error in place.
      expect(report.surface).toBe('in-sync');
      expect(report.verdict).toBe('broken');
      expect(report.typeErrors).toHaveLength(1);
    });

    it('calls a hook that stopped fitting a moved description drifted', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'hook.ts',
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${JSON.stringify(LAUNCHES)}, () => {});
`,
      );
      await harness.loadFormat(formatOf(BASE));
      await harness.init();
      // The operation the hook is anchored to is gone *and* the surface moved.
      await harness.loadFormat(
        formatOf([{ method: 'GET', path: '/astronauts', status: 200 }]),
      );

      const report = await harness.validate();

      expect(report.surface).toBe('behind');
      expect(report.verdict).toBe('drifted');
    });

    it('reports a vacuous glob and a zero-match filter without a type error', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'globs.ts',
        `import { beforeEach } from '@thymian/hooks';

export const vacuous = beforeEach({ path: '/nope/**' }, () => {});
export const empty = beforeEach({ path: '/launches', method: 'DELETE' }, () => {});
`,
      );
      await harness.loadFormat(formatOf(BASE));

      const report = await harness.validate();

      expect(report.verdict).toBe('broken');
      expect(report.unresolved.map((d) => d.reason).join('\n')).toContain(
        'matches no path in the loaded API description',
      );
      expect(report.unresolved.map((d) => d.reason).join('\n')).toContain(
        'intersect no transaction',
      );
    });

    it('reports a duplicate defineSample as a conflict', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'a.ts',
        `import { defineSample } from '@thymian/hooks';
export const a = defineSample(${JSON.stringify(LAUNCHES)}, () => {});
`,
      );
      await harness.writeHook(
        'b.ts',
        `import { defineSample } from '@thymian/hooks';
export const b = defineSample(${JSON.stringify(LAUNCHES)}, () => {});
`,
      );
      await harness.loadFormat(formatOf(BASE));

      const report = await harness.validate();

      expect(report.verdict).toBe('broken');
      expect(report.conflicts[0]?.reason).toContain(
        'defineSample is already defined',
      );
    });

    it('does not rewrite what is committed', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));
      await harness.init();
      await harness.loadFormat(
        formatOf([...BASE, { method: 'GET', path: '/rockets', status: 200 }]),
      );

      const path = join(
        harness.cwd,
        '.thymian',
        'sampler',
        'generated',
        'request-types.d.ts',
      );
      const before = await readFile(path, 'utf-8');

      await harness.validate();

      // A validate that regenerated in place would make `sync --check` pass by
      // having been run.
      await expect(readFile(path, 'utf-8')).resolves.toBe(before);
      await expect(harness.sync(true)).resolves.toMatchObject({
        changed: ['request-types.d.ts'],
      });
    });
  });

  describe('a run', () => {
    it('warns at load when the committed types are behind', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));
      await harness.init();

      expect(harness.warnings).toEqual([]);

      await harness.loadFormat(
        formatOf([...BASE, { method: 'GET', path: '/rockets', status: 200 }]),
      );

      expect(harness.warnings.join('\n')).toContain(
        'committed sampler types are behind this API description',
      );
      expect(harness.warnings.join('\n')).toContain('sampler sync');
    });

    it('says nothing at load when nothing is committed', async () => {
      const harness = await sampler();

      await harness.loadFormat(formatOf(BASE));

      // With no `generated/` there is nothing to be behind, so a project that
      // never ran `init` must not be nagged.
      expect(harness.warnings).toEqual([]);
    });

    it('refuses to start while a hook does not resolve', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'stale.ts',
        `import { beforeEach } from '@thymian/hooks';

export const stale = beforeEach('GET /gone -> 200 (application/json)', () => {});
`,
      );

      // Publishing the format is fine — `validate` has to survive it to report.
      await expect(harness.loadFormat(formatOf(BASE))).resolves.toBeUndefined();

      const [transaction] = formatOf(BASE).getThymianHttpTransactions();

      if (!transaction) {
        throw new Error('fixture has no transaction');
      }

      // Asking for the first request is not.
      await expect(
        harness.sample(transaction.transactionId, formatOf(BASE)),
      ).rejects.toThrowError(/does not resolve against the loaded/);
    });
  });
});
