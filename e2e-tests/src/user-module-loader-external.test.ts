import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getCleanEnv } from './env-utils.js';

// The foundational verification gate: at least the loader must be exercised
// through the built loader from outside the monorepo (real node_modules, no
// vitest import() interception). Every other .ts-loading test in
// packages/core runs inside vitest, whose own
// esbuild transform also happens to handle .ts on any dynamic import() —
// which is exactly the "green against the wrong module" failure class this
// harness exists to catch. This test installs the BUILT `@thymian/core`
// from the local Verdaccio registry (published by global.setup.ts) into a
// fresh, non-workspace `node_modules`, then loads a .ts rule through it as
// a plain `node` subprocess — no vitest anywhere in that process.
const fixturesDir = join(
  import.meta.dirname,
  '..',
  'fixtures',
  'user-module-loader-harness',
);

let projectDir: string;

function runHarness(): string {
  return execFileSync('node', ['load-rule.mjs'], {
    cwd: projectDir,
    env: getCleanEnv(),
    encoding: 'utf-8',
  });
}

describe('external built-loader harness', () => {
  beforeAll(() => {
    const version = process.env.THYMIAN_E2E_VERSION;
    const registry = process.env.npm_config_registry;

    if (!version || !registry) {
      throw new Error(
        'THYMIAN_E2E_VERSION and npm_config_registry must be set by the global setup (which publishes to Verdaccio) before this harness runs.',
      );
    }

    projectDir = mkdtempSync(join(tmpdir(), 'thymian-e2e-user-module-loader-'));

    execFileSync(
      'npm',
      [
        'install',
        `@thymian/core@${version}`,
        '--registry',
        registry,
        '--no-save',
      ],
      {
        cwd: projectDir,
        stdio: 'inherit',
        env: getCleanEnv(),
      },
    );

    cpSync(fixturesDir, projectDir, { recursive: true });
  }, 60_000);

  afterAll(() => {
    if (projectDir) {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('loads a .ts rule through the installed, built @thymian/core against the real jiti registry', () => {
    const output = runHarness();

    expect(output).toContain('PASS');
  });

  it('fails rather than falling through to a mock when the built output is deleted', () => {
    rmSync(join(projectDir, 'node_modules', '@thymian', 'core', 'dist'), {
      recursive: true,
      force: true,
    });

    expect(() => runHarness()).toThrow();
  });
});
