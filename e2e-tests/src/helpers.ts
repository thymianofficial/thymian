import { spawn, spawnSync } from 'node:child_process';
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

export interface ExecThymianResult {
  stdout: string;
  stderr: string;
  output: string;
  exitCode: number | null;
}

export function execThymian(
  args: string[],
  opts: { cwd?: string; allowFailure?: boolean } = {},
): string {
  const result = execThymianRaw(args, opts);
  return result.output;
}

export function execThymianRaw(
  args: string[],
  opts: { cwd?: string; allowFailure?: boolean } = {},
): ExecThymianResult {
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
  const output = stdout + stderr;
  if (result.status !== 0) {
    console.warn(
      `execThymian exited with status ${result.status ?? 'unknown'}`,
    );
    if (output) {
      console.warn(output);
    }
    if (opts.allowFailure) {
      return { stdout, stderr, output, exitCode: result.status };
    }
    const err = new Error(
      `execThymian failed with status ${result.status ?? 'unknown'}.\n\nOutput:\n${output}`,
    );
    throw err;
  }
  return { stdout, stderr, output, exitCode: result.status };
}

/**
 * Async version of execThymianRaw that uses `spawn` instead of `spawnSync`.
 * This keeps the Node.js event loop running, which is essential when the test
 * process also hosts a server that the spawned CLI process needs to reach.
 */
export function execThymianRawAsync(
  args: string[],
  opts: { cwd?: string; allowFailure?: boolean } = {},
): Promise<ExecThymianResult> {
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

  return new Promise<ExecThymianResult>((resolve, reject) => {
    const child = spawn(cmd, argv, {
      cwd: opts.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 90_000,
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');

    child.stdout.on('data', (chunk: string) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: string) => stderrChunks.push(chunk));

    child.on('error', reject);

    child.on('close', (code) => {
      const stdout = stdoutChunks.join('');
      const stderr = stderrChunks.join('');
      const output = stdout + stderr;
      const exitCode = code;

      if (code !== 0) {
        console.warn(`execThymian exited with status ${code ?? 'unknown'}`);
        if (output) {
          console.warn(output);
        }
        if (opts.allowFailure) {
          resolve({ stdout, stderr, output, exitCode });
          return;
        }
        reject(
          new Error(
            `execThymian failed with status ${code ?? 'unknown'}.\n\nOutput:\n${output}`,
          ),
        );
        return;
      }
      resolve({ stdout, stderr, output, exitCode });
    });
  });
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
