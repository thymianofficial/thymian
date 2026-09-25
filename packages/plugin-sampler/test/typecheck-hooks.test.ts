import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  resolveSamplerPaths,
  type SamplerPaths,
} from '../src/sampler-paths.js';
import { typecheckHooks } from '../src/validation/typecheck-hooks.js';

/**
 * #134: `validate` has to agree with the editor about tsconfig handling — an
 * extra `paths` alias resolves the same way in both, and a tsconfig that
 * fails to read or parse is a reported diagnostic rather than a silent
 * fallback to defaults. This exercises `typecheckHooks` directly against real
 * tsconfig fixtures on disk, per the parent issue's testing decisions.
 */
describe('typecheckHooks against real tsconfig fixtures', () => {
  const SURFACE = {
    requestTypes: 'export type Endpoints = Record<string, never>;\n',
    hooksApi:
      'export declare function beforeEach(target: string, fn: () => void): void;\n',
  };

  async function fixture(): Promise<SamplerPaths> {
    const cwd = await mkdtemp(join(tmpdir(), 'thymian-typecheck-hooks-'));
    const paths = resolveSamplerPaths(cwd);

    await mkdir(paths.hooksDir, { recursive: true });
    await mkdir(paths.generatedDir, { recursive: true });

    return paths;
  }

  async function writeTsconfig(
    paths: SamplerPaths,
    content: string,
  ): Promise<void> {
    await writeFile(paths.tsconfigPath, content, 'utf-8');
  }

  async function writeHook(paths: SamplerPaths, source: string): Promise<void> {
    await writeFile(join(paths.hooksDir, 'hook.ts'), source, 'utf-8');
  }

  it('resolves an extra `paths` alias exactly as the editor would, and keeps the user baseUrl', async () => {
    const paths = await fixture();

    // A hooks author's own alias, pointing at a file next to the sampler
    // root — resolved under the tsconfig's own `baseUrl`, the same as their
    // editor would.
    await mkdir(join(paths.root, 'lib'), { recursive: true });
    await writeFile(
      join(paths.root, 'lib', 'shared.ts'),
      'export const shared = 1;\n',
      'utf-8',
    );
    await writeTsconfig(
      paths,
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          strict: true,
          paths: {
            '@lib/*': ['./lib/*'],
          },
        },
      }),
    );
    await writeHook(
      paths,
      `import { beforeEach } from '@thymian/hooks';
import { shared } from '@lib/shared';

export const hook = beforeEach('GET /x', () => {
  void shared;
});
`,
    );

    const errors = await typecheckHooks(paths, SURFACE, ['hook.ts']);

    expect(errors).toEqual([]);
  });

  it('reports a hook-author alias that does not resolve, proving the merge did not silently drop it', async () => {
    const paths = await fixture();

    await writeTsconfig(
      paths,
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          strict: true,
          paths: {
            '@lib/*': ['./lib/*'],
          },
        },
      }),
    );
    await writeHook(
      paths,
      `import { beforeEach } from '@thymian/hooks';
import { shared } from '@lib/shared';

export const hook = beforeEach('GET /x', () => {
  void shared;
});
`,
    );

    const errors = await typecheckHooks(paths, SURFACE, ['hook.ts']);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('@lib/shared');
  });

  /**
   * A `.js` hook is legal and deliberately un-type-checked: the loader accepts
   * `.js`/`.mjs`/`.cjs`, and nothing about it can be checked against the
   * generated surface. Passed to `createProgram` without `allowJs` it becomes
   * TS6504 — a program-level diagnostic with no file of its own, so it lands
   * on `tsconfig.json:1:1` and renders the whole surface `broken` for a hook
   * that runs perfectly.
   */
  it('leaves a JavaScript hook out of the program instead of reporting it broken', async () => {
    const paths = await fixture();

    await writeTsconfig(
      paths,
      JSON.stringify({ compilerOptions: { strict: true } }),
    );
    await writeFile(
      join(paths.hooksDir, 'seed.js'),
      'export const seed = 1;\n',
      'utf-8',
    );

    await expect(typecheckHooks(paths, SURFACE, ['seed.js'])).resolves.toEqual(
      [],
    );
  });

  /**
   * The ordinary state right after `sampler init`: a scaffolded tsconfig whose
   * `include` names `hooks/**` and `generated/**`, and neither has anything in
   * it yet. TS18003 is raised against that `include`, which this check never
   * compiles by — the roots are passed explicitly — so reporting it renders
   * `broken` over an empty tree.
   */
  it('does not report an include that matches no files', async () => {
    const paths = await fixture();

    await writeTsconfig(
      paths,
      JSON.stringify({
        compilerOptions: { strict: true },
        include: ['./hooks/**/*.ts', './generated/**/*.d.ts'],
      }),
    );

    await expect(typecheckHooks(paths, SURFACE, [])).resolves.toEqual([]);
  });

  it('reports a tsconfig that fails to parse as a diagnostic, not a silent fallback', async () => {
    const paths = await fixture();

    await writeTsconfig(paths, '{ this is not json');
    await writeHook(
      paths,
      `import { beforeEach } from '@thymian/hooks';

export const hook = beforeEach('GET /x', () => {});
`,
    );

    const errors = await typecheckHooks(paths, SURFACE, ['hook.ts']);

    // The hook itself is fine — the fallback options still let it compile —
    // but the broken tsconfig must show up, not vanish into a clean report.
    expect(errors).toContainEqual(
      expect.objectContaining({ file: 'tsconfig.json' }),
    );
  });

  it('reports a tsconfig with invalid compiler options as a diagnostic', async () => {
    const paths = await fixture();

    await writeTsconfig(
      paths,
      JSON.stringify({
        compilerOptions: {
          // `target` is not a real target string: `parseJsonConfigFileContent`
          // rejects it as an options-conversion error, never as a JSON
          // syntax error.
          target: 'not-a-real-target',
        },
      }),
    );
    await writeHook(
      paths,
      `import { beforeEach } from '@thymian/hooks';

export const hook = beforeEach('GET /x', () => {});
`,
    );

    const errors = await typecheckHooks(paths, SURFACE, ['hook.ts']);

    expect(errors).toContainEqual(
      expect.objectContaining({ file: 'tsconfig.json' }),
    );
  });

  it('never crashes on a malformed tsconfig even with no hooks to check', async () => {
    const paths = await fixture();

    await writeTsconfig(paths, '{ this is not json');

    await expect(typecheckHooks(paths, SURFACE, [])).resolves.toEqual([
      expect.objectContaining({ file: 'tsconfig.json' }),
    ]);
  });

  it('still typechecks the hook alongside a malformed tsconfig, using the fallback options', async () => {
    const paths = await fixture();

    await writeTsconfig(paths, '{ this is not json');
    await writeHook(
      paths,
      `import { beforeEach } from '@thymian/hooks';

export const hook = beforeEach('GET /x', (request: string) => {
  void request;
});
`,
    );

    const errors = await typecheckHooks(paths, SURFACE, ['hook.ts']);

    // Two independent complaints: the broken tsconfig, and a real type error
    // in the hook that the fallback options still catch.
    const files = errors.map((e) => e.file).sort();
    expect(files).toEqual([join('hooks', 'hook.ts'), 'tsconfig.json']);
  });
});
