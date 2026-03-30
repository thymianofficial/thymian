import { type ChildProcess, exec, execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { waitFor } from 'cli-testing-library';
import type { TestProject } from 'vitest/node';

const rootDir = join(import.meta.dirname, '..', '..');

const thymianVersion = '0.0.1-e2e';
const verdaccioUrl = 'http://localhost:4873';

let verdaccioProcess: ChildProcess;
let globalPrefix: string;

export default async function setup(_project: TestProject) {
  // Registry isolation: all npm operations resolve packages from Verdaccio
  process.env.npm_config_registry = verdaccioUrl;

  verdaccioProcess = exec(
    'npm run local-registry',
    {
      cwd: rootDir,
    },
    (error, stdout, stderr) => {
      if (error) {
        console.error(`verdaccio - exec error: ${error}`);
        return;
      }
      console.log(`verdaccio - stdout: ${stdout}`);
      console.error(`verdaccio - stderr: ${stderr}`);
    },
  );

  await waitFor(
    async () => {
      const response = await fetch(verdaccioUrl);
      if (!response.ok) {
        throw new Error('Verdaccio is not ready yet');
      }
    },
    { timeout: 10000 },
  );

  console.log('Publishing e2e test Thymian version');
  let output = execSync(
    `npm run local-publish -- --dist-tag latest --version ${thymianVersion}`,
    {
      cwd: rootDir,
    },
  ).toString();

  try {
    await waitFor(
      () => output.includes(`Successfully ran target nx-release-publish`),
      {
        timeout: 10000,
      },
    );
  } catch (error) {
    console.error(
      'Failed to publish thymian version. Shutting down Verdaccio.',
    );
    verdaccioProcess.kill();
    throw error;
  }

  // Global install isolation: redirect to temp dir via npm_config_prefix
  globalPrefix = mkdtempSync(join(tmpdir(), 'thymian-e2e-global-'));
  console.log(
    `Installing e2e test Thymian version to isolated prefix: ${globalPrefix}`,
  );
  output = execSync(`npm install -g @thymian/cli@${thymianVersion}`, {
    env: { ...process.env, npm_config_prefix: globalPrefix },
  }).toString();
  console.log(output);

  try {
    const installRgx = /added \d+ packages?/gim;
    await waitFor(() => installRgx.test(output), {
      timeout: 10000,
    });
    console.log('Thymian version installed successfully');
  } catch (error) {
    console.error(
      'Failed to install thymian version. Shutting down Verdaccio.',
    );
    verdaccioProcess.kill();
    throw error;
  }

  // Expose environment for tests
  process.env.THYMIAN_E2E_VERSION = thymianVersion;
  process.env.THYMIAN_E2E_GLOBAL_BIN = join(globalPrefix, 'bin', 'thymian');
  process.env.THYMIAN_E2E_GLOBAL_PREFIX = globalPrefix;
}

export function teardown() {
  console.log('Shutting down local registry');
  verdaccioProcess.kill();

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
