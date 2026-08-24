import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymian,
  execThymianRawAsync,
  fixturesDir,
  useTempDir,
} from './helpers.js';
import { getAvailablePort } from './port-utils.js';

/**
 * The selector of the one transaction `dynamic-test` declares. Host-stripped,
 * media-typed, ASCII — see `src/selectors/selector.ts`.
 */
const HELLO = 'GET /api/hello -> 200 (application/json)';

async function setup(
  tempDir: string,
  onRequest?: () => void,
): Promise<{ server: FastifyInstance; targetUrl: string }> {
  copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), tempDir);

  const port = await getAvailablePort();
  const server = fastify();

  if (onRequest) {
    server.addHook('onRequest', async () => onRequest());
  }

  server.get<{ Querystring: { name: string } }>('/api/hello', async (req) => {
    return { content: `Hello ${req.query.name}` };
  });

  await server.listen({ port, host: '0.0.0.0' });

  return { server, targetUrl: `http://localhost:${port}` };
}

function writeV2Hook(tempDir: string, name: string, body: string): void {
  const hooksDir = join(tempDir, '.thymian', 'sampler', 'hooks');
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(join(hooksDir, name), body);
}

/**
 * The `@thymian/hooks` alias target, as it exists in the **installed** package.
 *
 * No unit test can assert this: under Vitest the alias always resolves to
 * `src/hooks/hook-api.ts`, so an assertion about `src/` holds regardless of what
 * the tarball ships. Resolution goes through the installed CLI's own `require`,
 * so a hoisted and a nested layout both work.
 */
function installedHookApi(): string | undefined {
  const prefix = process.env['THYMIAN_E2E_GLOBAL_PREFIX'];

  if (!prefix) {
    return undefined;
  }

  for (const cliRoot of [
    join(prefix, 'lib', 'node_modules', 'thymian'),
    join(prefix, 'node_modules', 'thymian'),
  ]) {
    if (!existsSync(join(cliRoot, 'package.json'))) {
      continue;
    }

    try {
      const manifest = createRequire(join(cliRoot, 'package.json')).resolve(
        '@thymian/plugin-sampler/package.json',
      );

      return join(dirname(manifest), 'dist', 'hooks', 'hook-api.js');
    } catch {
      // Fall through to the next candidate layout.
    }
  }

  return undefined;
}

describe('sampler v2 hook loading', () => {
  const getTempDir = useTempDir();

  it('ships the `@thymian/hooks` runtime module inside the published package', () => {
    // `files: ["dist"]` is the whole reason the runtime module has to live under
    // `src/`. This is the only place that claim is checked against a real
    // installed package rather than against the source tree.
    const hookApi = installedHookApi();

    expect(
      hookApi,
      'the installed CLI must expose @thymian/plugin-sampler',
    ).toBeDefined();
    expect(existsSync(hookApi as string)).toBe(true);
  });

  it('executes a hook that imports `@thymian/hooks` with no `sampler init`', async () => {
    // This is the check no unit test can make: e2e installs the **published**
    // CLI, so the jiti alias has to resolve `dist/hooks/hook-api.js`, not the
    // `src/` file Vitest sees. And the workspace has never run `init`, so there
    // is no `generated/` directory and no generated tsconfig to resolve against.
    const { server, targetUrl } = await setup(getTempDir());

    writeV2Hook(
      getTempDir(),
      'tag.ts',
      [
        `import { writeFileSync } from 'node:fs';`,
        `import { join } from 'node:path';`,
        `import { beforeEach } from '@thymian/hooks';`,
        ``,
        `export const tagged = beforeEach(${JSON.stringify(HELLO)}, async (value) => {`,
        `  writeFileSync(join(process.cwd(), 'hook-ran.txt'), 'yes');`,
        `  return value;`,
        `});`,
        ``,
      ].join('\n'),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.output).not.toContain('HookResolutionError');
      expect(result.exitCode).toBe(0);
      // The observable side effect. A hook that merely returns its input would
      // be indistinguishable from a hook that never ran.
      expect(existsSync(join(getTempDir(), 'hook-ran.txt'))).toBe(true);
      // Still no samples tree: hooks do not resurrect one.
      expect(existsSync(join(getTempDir(), '.thymian', 'samples'))).toBe(false);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('loads hooks from nested directories and skips dot-directories', async () => {
    const { server, targetUrl } = await setup(getTempDir());

    const hooksDir = join(getTempDir(), '.thymian', 'sampler', 'hooks');
    mkdirSync(join(hooksDir, 'nested'), { recursive: true });
    mkdirSync(join(hooksDir, '.skipped'), { recursive: true });

    writeFileSync(
      join(hooksDir, 'nested', 'deep.ts'),
      [
        `import { writeFileSync } from 'node:fs';`,
        `import { join } from 'node:path';`,
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(${JSON.stringify(HELLO)}, async (value) => {`,
        `  writeFileSync(join(process.cwd(), 'nested-ran.txt'), 'yes');`,
        `  return value;`,
        `});`,
        ``,
      ].join('\n'),
    );

    // A dot-directory inside the hooks dir is skipped — this hook targets a
    // selector that does not exist, so if it were loaded the run would fail.
    writeFileSync(
      join(hooksDir, '.skipped', 'ignored.ts'),
      [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('GET /not-a-real-path -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(getTempDir(), 'nested-ran.txt'))).toBe(true);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('fails before the first request, listing every unresolvable hook', async () => {
    let requestCount = 0;
    const { server, targetUrl } = await setup(getTempDir(), () => {
      requestCount += 1;
    });

    writeV2Hook(
      getTempDir(),
      'a-gone.ts',
      [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const a = beforeEach('GET /renamed-one -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
    );
    writeV2Hook(
      getTempDir(),
      'b-gone.ts',
      [
        `import { afterEach } from '@thymian/hooks';`,
        `export const b = afterEach('GET /renamed-two -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir(), allowFailure: true },
      );

      expect(result.exitCode).not.toBe(0);
      // Both, in one message — not one edit-run cycle per broken hook.
      expect(result.output).toContain('a-gone.ts');
      expect(result.output).toContain('b-gone.ts');
      expect(result.output).toContain('GET /renamed-one -> 200');
      expect(result.output).toContain('GET /renamed-two -> 200');
      // "Fails fast" means exactly this: nothing was dispatched.
      expect(requestCount).toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);
});

describe('the v1 samples tree no longer supplies hooks', () => {
  const getTempDir = useTempDir();

  it('never imports a v1 hook file from a materialized tree (#615)', async () => {
    const { server, targetUrl } = await setup(getTempDir());

    // A real v1 tree, produced by the real generator.
    execThymian(['sampler', 'init'], { cwd: getTempDir() });
    expect(existsSync(join(getTempDir(), '.thymian', 'samples'))).toBe(true);

    // A v1 hook file whose *import* has an observable side effect. Nothing
    // weaker demonstrates "no v1 hook file is imported or executed": a v1 hook
    // that returns its input is invisible whether it ran or not.
    writeFileSync(
      join(getTempDir(), '.thymian', 'samples', 'custom.beforeEach.ts'),
      [
        `import { writeFileSync } from 'node:fs';`,
        `import { join } from 'node:path';`,
        `writeFileSync(join(process.cwd(), 'v1-hook-imported.txt'), 'yes');`,
        `export default async function beforeEach(value) {`,
        `  writeFileSync(join(process.cwd(), 'v1-hook-ran.txt'), 'yes');`,
        `  return value;`,
        `}`,
        ``,
      ].join('\n'),
    );

    // And no v2 hooks directory at all.
    expect(existsSync(join(getTempDir(), '.thymian', 'sampler', 'hooks'))).toBe(
      false,
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(getTempDir(), 'v1-hook-imported.txt'))).toBe(
        false,
      );
      expect(existsSync(join(getTempDir(), 'v1-hook-ran.txt'))).toBe(false);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('runs clean when the tree exists but cannot be read (#613)', async () => {
    const { server, targetUrl } = await setup(getTempDir());

    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    // A leftover or interrupted tree. `thymian test` needs no tree at all, so a
    // broken one must not fail the run — only `sampler.path-from-transaction`
    // depends on it, and it raises its own error when invoked.
    writeFileSync(join(getTempDir(), '.thymian', 'samples', 'meta.json'), '{');

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(
        /Summary: 0 errors, 0 warnings, 0 hints, \d+ infos?\./,
      );
    } finally {
      await server.close();
    }
  }, 180_000);
});
