import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getCleanEnv } from './env-utils.js';

// Foundational verification gate: every other .ts-plugin-loading test in this
// repo runs inside vitest, whose own esbuild transform also happens to handle
// .ts on any
// dynamic import() — the exact "green against the wrong module" failure
// class this harness exists to catch. This test installs the BUILT
// `thymian` CLI (and its `@thymian/core` dependency) from the local
// Verdaccio registry (published by global.setup.ts) into a fresh,
// non-workspace `node_modules`, then runs the installed CLI binary as a
// plain subprocess — no vitest anywhere in that process — with
// `--plugin ./valid-plugin.plugin.ts`.
const fixturesDir = join(
  import.meta.dirname,
  '..',
  'fixtures',
  'plugin-loader-harness',
);

let projectDir: string;

function runHarness(): string {
  return execFileSync(
    join(projectDir, 'node_modules', '.bin', 'thymian'),
    ['rules', 'list', '--plugin', './valid-plugin.plugin.ts'],
    {
      cwd: projectDir,
      env: getCleanEnv(),
      encoding: 'utf-8',
    },
  );
}

describe('external built-loader harness for plugins', () => {
  beforeAll(() => {
    const version = process.env.THYMIAN_E2E_VERSION;
    const registry = process.env.npm_config_registry;

    if (!version || !registry) {
      throw new Error(
        'THYMIAN_E2E_VERSION and npm_config_registry must be set by the global setup (which publishes to Verdaccio) before this harness runs.',
      );
    }

    projectDir = mkdtempSync(join(tmpdir(), 'thymian-e2e-plugin-loader-'));

    execFileSync(
      'npm',
      ['install', `thymian@${version}`, '--registry', registry, '--no-save'],
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

  it('loads and registers a .ts plugin through the installed, built thymian CLI against the real jiti registry', () => {
    const output = runHarness();

    expect(output).toContain('rule(s) loaded.');
  });

  it('fails rather than falling through to a mock when the built @thymian/core output is deleted', () => {
    rmSync(join(projectDir, 'node_modules', '@thymian', 'core', 'dist'), {
      recursive: true,
      force: true,
    });

    expect(() => runHarness()).toThrow();
  });
});
