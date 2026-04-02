import { spawnSync } from 'node:child_process';
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

export interface SpawnThymianResult {
  stdout: string;
  stderr: string;
  status: number | null;
  output: string;
}

/**
 * Spawn the thymian CLI and return separate stdout, stderr, status code, and
 * combined output. Use this when you need to assert on stream separation or
 * exit codes directly.
 */
export function spawnThymian(
  args: string[],
  opts: { cwd?: string } = {},
): SpawnThymianResult {
  const version = process.env.THYMIAN_E2E_VERSION ?? '';
  const env = getCleanEnv();
  let cmd: string;
  let argv: string[];
  switch (installationMode) {
    case 'npx':
      cmd = npxCmd;
      argv = ['--yes', `@thymian/cli@${version}`, ...args];
      break;
    case 'global': {
      cmd = process.env.THYMIAN_E2E_GLOBAL_BIN ?? 'thymian';
      argv = args;
      break;
    }
    case 'local':
      throw new Error('Local installation mode not yet implemented');
  }
  const result = spawnSync(cmd, argv, {
    cwd: opts.cwd,
    env,
    encoding: 'utf-8',
    timeout: 90_000,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return {
    stdout,
    stderr,
    status: result.status,
    output: stdout + stderr,
  };
}

export function execThymian(
  args: string[],
  opts: { cwd?: string; allowFailure?: boolean } = {},
): string {
  const { status, output } = spawnThymian(args, { cwd: opts.cwd });
  if (status !== 0) {
    console.warn(`execThymian exited with status ${status ?? 'unknown'}`);
    if (output) {
      console.warn(output);
    }
    if (opts.allowFailure) {
      return output;
    }
    const err = new Error(
      `execThymian failed with status ${status ?? 'unknown'}.\n\nOutput:\n${output}`,
    );
    throw err;
  }
  return output;
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
