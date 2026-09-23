import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import type { TestProject } from 'vitest/node';

import { getCleanEnv } from './env-utils.js';

const rootDir = join(import.meta.dirname, '..', '..');

const thymianVersion = '0.0.1-e2e';
const verdaccioPort = 4873;
const verdaccioUrl = `http://localhost:${verdaccioPort}`;

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

let verdaccioProcess: ChildProcess;
let globalPrefix: string;
let npmrcDir: string;

function killVerdaccio() {
  if (!verdaccioProcess) {
    return;
  }

  const pid = verdaccioProcess.pid;
  if (!pid) {
    try {
      verdaccioProcess.kill();
    } catch {
      // ignore
    }
    return;
  }

  if (isWindows) {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } catch {
      try {
        verdaccioProcess.kill();
      } catch {
        // ignore
      }
    }
    return;
  }

  // POSIX: SIGTERM first for graceful shutdown, then SIGKILL
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      verdaccioProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      verdaccioProcess.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
}

function stopRegistry() {
  killVerdaccio();
  if (npmrcDir) {
    rmSync(npmrcDir, { recursive: true, force: true });
  }
}

export default async function setup(_project: TestProject) {
  // Kill any stale Verdaccio process occupying the port from a previous run
  // so the new instance can bind to the expected port.
  if (!isWindows) {
    try {
      execSync(`lsof -ti :${verdaccioPort} | xargs kill -9`, {
        stdio: 'ignore',
      });
      // Brief pause to let the OS release the port
      await sleep(500);
    } catch {
      console.log(
        `No process is listening on port ${verdaccioPort} - nothing to clean up.`,
      );
    }
  }

  // Config isolation: by default the @nx/js:verdaccio executor writes the
  // registry and an auth token into ~/.npmrc and ~/.yarnrc, restoring them only
  // on a graceful exit that a killed run never reaches. `--location none`
  // turns those writes off; publishing gets its token from a throwaway npmrc.
  npmrcDir = mkdtempSync(join(tmpdir(), 'thymian-e2e-npmrc-'));
  const npmrc = join(npmrcDir, '.npmrc');
  writeFileSync(
    npmrc,
    `//localhost:${verdaccioPort}/:_authToken=thymian-e2e-token\n`,
  );

  verdaccioProcess = spawn(
    npmCmd,
    ['run', 'local-registry', '--', '--location', 'none'],
    {
      cwd: rootDir,
      detached: true,
      stdio: 'ignore',
    },
  );
  verdaccioProcess.unref();

  let verdaccioReady = false;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(verdaccioUrl);
      if (response.ok) {
        verdaccioReady = true;
        break;
      }
    } catch {
      // not ready yet
    }
    await sleep(200);
  }
  if (!verdaccioReady) {
    stopRegistry();
    throw new Error(
      `Verdaccio did not become ready within 10 seconds at ${verdaccioUrl}`,
    );
  }

  console.log('Publishing e2e test Thymian version');
  const cleanEnv = getCleanEnv();

  // Registry isolation is scoped per call: each npm invocation that needs
  // Verdaccio gets `npm_config_registry` in its own env. Never set it on this
  // process's `process.env` (ADR-0006).
  try {
    execSync(
      `npm run local-publish -- --dist-tag latest --version ${thymianVersion}`,
      {
        cwd: rootDir,
        stdio: 'inherit',
        env: {
          ...cleanEnv,
          npm_config_registry: verdaccioUrl,
          // npm refuses to publish without a token, even to an open registry.
          npm_config_userconfig: npmrc,
        },
      },
    );
  } catch {
    console.error(
      'Failed to publish thymian version. Shutting down Verdaccio.',
    );
    stopRegistry();
    throw new Error('nx-release-publish did not succeed');
  }

  // Global install isolation: redirect to temp dir via npm_config_prefix
  globalPrefix = mkdtempSync(join(tmpdir(), 'thymian-e2e-global-'));
  console.log(
    `Installing e2e test Thymian version to isolated prefix: ${globalPrefix}`,
  );
  try {
    execSync(
      `npm install -g thymian@${thymianVersion} --registry ${verdaccioUrl}`,
      {
        stdio: 'inherit',
        env: {
          ...cleanEnv,
          npm_config_prefix: globalPrefix,
          npm_config_registry: verdaccioUrl,
        },
      },
    );
  } catch {
    console.error(
      'Failed to install thymian version. Shutting down Verdaccio.',
    );
    rmSync(globalPrefix, { recursive: true, force: true });
    stopRegistry();
    throw new Error('npm install -g failed');
  }
  console.log('Thymian version installed successfully');

  // Resolve the global bin path for this prefix/platform
  const thymianGlobalBin = isWindows
    ? join(globalPrefix, 'thymian.cmd')
    : join(globalPrefix, 'bin', 'thymian');

  // Expose environment for tests
  process.env.THYMIAN_E2E_VERSION = thymianVersion;
  process.env.THYMIAN_E2E_REGISTRY = verdaccioUrl;
  process.env.THYMIAN_E2E_GLOBAL_BIN = thymianGlobalBin;
  process.env.THYMIAN_E2E_GLOBAL_PREFIX = globalPrefix;

  return teardown;
}

function teardown() {
  console.log('Shutting down local registry');
  stopRegistry();

  // Clean up isolated global prefix
  if (globalPrefix) {
    console.log(`Cleaning up global prefix: ${globalPrefix}`);
    rmSync(globalPrefix, { recursive: true, force: true });
  }

  // Clean up environment variables
  delete process.env.THYMIAN_E2E_VERSION;
  delete process.env.THYMIAN_E2E_REGISTRY;
  delete process.env.THYMIAN_E2E_GLOBAL_BIN;
  delete process.env.THYMIAN_E2E_GLOBAL_PREFIX;
}
