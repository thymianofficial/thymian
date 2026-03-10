import { type ChildProcess, exec, execSync } from 'node:child_process';

import { waitFor } from 'cli-testing-library';
import { join } from 'path';
import type { TestProject } from 'vitest/node';

const dirname = import.meta.dirname;
const rootDir = join(dirname, '..', '..');

export const thymianVersion = '0.0.1-e2e';

let verdaccioProcess: ChildProcess;

export default async function setup(project: TestProject) {
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
      const response = await fetch('http://localhost:4873');
      if (!response.ok) {
        throw new Error('Verdaccio is not ready yet');
      }
    },
    { timeout: 10000 },
  );

  console.log('Publishing e2e test Thymian version');
  let output = execSync(
    `npm run local-publish -- --version ${thymianVersion}`,
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

  console.log('Installing e2e test Thymian version');
  output = execSync(`npm install -g @thymian/cli@${thymianVersion}`).toString();
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
}

export function teardown() {
  console.log('Shutting down local registry');
  verdaccioProcess.kill();
}
