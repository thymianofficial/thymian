import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { render } from 'cli-testing-library';
import { afterEach, beforeEach } from 'vitest';

import { getCleanEnv } from './env-utils.js';

export const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

export type InstallationMode = 'npx' | 'global' | 'local';
const validModes: InstallationMode[] = ['npx', 'global', 'local'];
const rawMode = process.env.THYMIAN_E2E_MODE || 'npx';
if (!validModes.includes(rawMode as InstallationMode)) {
  throw new Error(
    `Invalid THYMIAN_E2E_MODE: '${rawMode}'. Must be one of: ${validModes.join(', ')}`,
  );
}
export const installationMode: InstallationMode = rawMode as InstallationMode;

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

/**
 * Resolve the command and argument list for the current installation mode.
 */
function resolveThymianCommand(args: string[]): {
  cmd: string;
  argv: string[];
} {
  const version = process.env.THYMIAN_E2E_VERSION ?? '';
  switch (installationMode) {
    case 'npx':
      return {
        cmd: npxCmd,
        argv: ['--yes', `@thymian/cli@${version}`, ...args],
      };
    case 'global':
      return {
        cmd: process.env.THYMIAN_E2E_GLOBAL_BIN ?? 'thymian',
        argv: args,
      };
    case 'local':
      throw new Error('Local installation mode not yet implemented');
  }
}

/**
 * Spawn thymian synchronously and return the raw SpawnSyncReturns result.
 */
function spawnThymian(
  args: string[],
  opts: { cwd?: string } = {},
): SpawnSyncReturns<string> {
  const { cmd, argv } = resolveThymianCommand(args);
  const env = getCleanEnv();
  return spawnSync(cmd, argv, {
    cwd: opts.cwd,
    env,
    encoding: 'utf-8',
    timeout: 90_000,
  });
}

export function execThymian(
  args: string[],
  opts: { cwd?: string; allowFailure?: boolean } = {},
): string {
  const result = spawnThymian(args, opts);
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  if (result.status !== 0) {
    console.warn(
      `execThymian exited with status ${result.status ?? 'unknown'}`,
    );
    if (output) {
      console.warn(output);
    }
    if (opts.allowFailure) {
      return output;
    }
    const err = new Error(
      `execThymian failed with status ${result.status ?? 'unknown'}.\n\nOutput:\n${output}`,
    );
    throw err;
  }
  return output;
}

export interface ThymianResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Execute thymian and return stdout, stderr, and exitCode separately.
 * Never throws on non-zero exit — callers can assert on exitCode.
 */
export function execThymianResult(
  args: string[],
  opts: { cwd?: string } = {},
): ThymianResult {
  const result = spawnThymian(args, opts);
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status,
  };
}

export function renderThymian(args: string[], opts?: { cwd?: string }) {
  const version = process.env.THYMIAN_E2E_VERSION ?? '';
  const env = getCleanEnv();
  switch (installationMode) {
    case 'npx':
      return render('npx', ['--yes', `@thymian/cli@${version}`, ...args], {
        ...opts,
        env,
      });
    case 'global':
      return render(process.env.THYMIAN_E2E_GLOBAL_BIN ?? 'thymian', args, {
        ...opts,
        env,
      });
    case 'local':
      throw new Error('Local installation mode not yet implemented');
  }
}

export function copyFixturesToTempDir(sourceDir: string, tempDir: string) {
  cpSync(sourceDir, tempDir, { recursive: true, force: true });
}

export function writeConfigToTempDir(
  tempDir: string,
  config: string,
  filename = 'thymian.config.yaml',
) {
  writeFileSync(join(tempDir, filename), config, 'utf-8');
}

/**
 * Sets up and tears down a temporary directory for each test.
 * Returns a getter function that returns the current temp dir path.
 */
export function useTempDir(): () => string {
  let e2eTempDir = '';

  beforeEach(() => {
    e2eTempDir = mkdtempSync(join(tmpdir(), 'thymian-e2e-'));
    console.log(`Created e2e test temp dir: ${e2eTempDir}`);
  });

  afterEach(() => {
    console.log(`Removing e2e test temp dir: ${e2eTempDir}`);
    rmSync(e2eTempDir, { recursive: true, force: true });
  });

  return () => e2eTempDir;
}
