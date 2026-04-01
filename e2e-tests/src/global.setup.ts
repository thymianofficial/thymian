import { type ChildProcess, execSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import type { TestProject } from 'vitest/node';

import { getCleanEnv } from './env-utils.js';

const rootDir = join(import.meta.dirname, '..', '..');

const thymianVersion = '0.0.1-e2e';
const verdaccioPort = 4873;
const verdaccioUrl = `http://localhost:${verdaccioPort}`;
const npmrcPath = join(rootDir, '.npmrc');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

let verdaccioProcess: ChildProcess;
let globalPrefix: string;
const previousNpmrc: string | null = null;

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

export default async function setup(_project: TestProject) {
  // Registry isolation: all npm operations resolve packages from Verdaccio
  process.env.npm_config_registry = verdaccioUrl;

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
      // No process on that port — nothing to clean up
    }
  }

  verdaccioProcess = spawn(npmCmd, ['run', 'local-registry'], {
    cwd: rootDir,
    detached: true,
    stdio: 'ignore',
  });
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
    killVerdaccio();
    throw new Error(
      `Verdaccio did not become ready within 10 seconds at ${verdaccioUrl}`,
    );
  }

  console.log('Publishing e2e test Thymian version');
  const cleanEnv = getCleanEnv();

  try {
    execSync(
      `npm run local-publish -- --dist-tag latest --version ${thymianVersion}`,
      {
        cwd: rootDir,
        stdio: 'inherit',
        env: { ...cleanEnv, npm_config_registry: verdaccioUrl },
      },
    );
  } catch {
    console.error(
      'Failed to publish thymian version. Shutting down Verdaccio.',
    );
    killVerdaccio();
    throw new Error('nx-release-publish did not succeed');
  }

  // Global install isolation: redirect to temp dir via npm_config_prefix
  globalPrefix = mkdtempSync(join(tmpdir(), 'thymian-e2e-global-'));
  console.log(
    `Installing e2e test Thymian version to isolated prefix: ${globalPrefix}`,
  );
  try {
    execSync(
      `npm install -g @thymian/cli@${thymianVersion} --registry ${verdaccioUrl}`,
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
    killVerdaccio();
    throw new Error('npm install -g failed');
  }
  console.log('Thymian version installed successfully');

  // Resolve the global bin path for this prefix/platform
  const thymianGlobalBin = isWindows
    ? join(globalPrefix, 'thymian.cmd')
    : join(globalPrefix, 'bin', 'thymian');

  // Expose environment for tests
  process.env.THYMIAN_E2E_VERSION = thymianVersion;
  process.env.THYMIAN_E2E_GLOBAL_BIN = thymianGlobalBin;
  process.env.THYMIAN_E2E_GLOBAL_PREFIX = globalPrefix;

  return teardown;
}

function teardown() {
  console.log('Shutting down local registry');
  killVerdaccio();

  // Clean up isolated global prefix
  if (globalPrefix) {
    console.log(`Cleaning up global prefix: ${globalPrefix}`);
    rmSync(globalPrefix, { recursive: true, force: true });
  }

  // Clean up environment variables
  delete process.env.npm_config_registry;
  delete process.env.THYMIAN_E2E_VERSION;
  delete process.env.THYMIAN_E2E_GLOBAL_BIN;
  delete process.env.THYMIAN_E2E_GLOBAL_PREFIX;
}
