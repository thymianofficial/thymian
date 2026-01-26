import { execSync } from 'node:child_process';

import { ReleaseClient } from 'nx/release/index.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function isVerdaccioRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

(async () => {
  const argv = await yargs(hideBin(process.argv))
    .version(false)
    .option('version', {
      description:
        'Explicit version specifier to use, if overriding conventional commits',
      type: 'string',
    })
    .option('dryRun', {
      alias: 'd',
      description:
        'Whether or not to perform a dry-run of the release process, defaults to true',
      type: 'boolean',
      default: true,
    })
    .option('firstRelease', {
      description: 'Treat this as the first release for the workspace/projects',
      type: 'boolean',
      default: false,
    })
    .option('verbose', {
      description: 'Whether or not to enable verbose logging, defaults to true',
      type: 'boolean',
      default: true,
    })
    .option('local', {
      description:
        'Whether to use local registry (http://localhost:4873), defaults to true',
      type: 'boolean',
      default: true,
    })
    .parseAsync();

  const isCanary = isCanaryRelease(argv.version);

  console.log(`\n${isCanary ? '🐤' : '📋'} Release Configuration:`);
  console.log(`  mode: ${isCanary ? 'CANARY' : 'STANDARD'}`);
  console.log(`  version: ${argv.version || 'conventional commits'}`);
  console.log(`  dryRun: ${argv.dryRun}`);
  console.log(`  firstRelease: ${argv.firstRelease}`);
  console.log(`  verbose: ${argv.verbose}`);
  console.log(`  local: ${argv.local}`);
  console.log(`  registry: ${argv.local ? 'http://localhost:4873' : 'npm'}\n`);

  if (argv.local && !argv.dryRun) {
    const isRunning = await isVerdaccioRunning('http://localhost:4873/');
    if (!isRunning) {
      console.error(
        '❌ Error: Local verdaccio is not running on http://localhost:4873/',
      );
      console.error('Please start verdaccio with: npm run local-registry');
      process.exit(1);
    }
  }

  const client = new ReleaseClient({});

  // For canary releases, first get the next version using conventional commits
  let versionSpecifier = argv.version;
  let canaryVersionString: string | undefined;

  if (isCanary) {
    console.log('🔍 Determining next version from conventional commits...\n');

    const { workspaceVersion: nextVersion } = await client.releaseVersion({
      specifier: undefined, // Let conventional commits determine version
      dryRun: true, // Don't actually version yet
      firstRelease: argv.firstRelease,
      verbose: argv.verbose,
      gitTag: false,
    });

    if (!nextVersion) {
      console.log(
        'ℹ️  No release needed (no relevant commits since last release)',
      );
      console.log('   Exiting gracefully.\n');
      process.exit(0);
    }

    const commitHash = getCurrentCommitHash();
    canaryVersionString = getCanaryVersion(nextVersion, commitHash);
    versionSpecifier = canaryVersionString;

    console.log(`📦 Canary version: ${canaryVersionString}`);
    console.log(`   Base version: ${nextVersion}`);
    console.log(`   Commit hash: ${commitHash}\n`);
  }

  const { workspaceVersion, projectsVersionData, releaseGraph } =
    await client.releaseVersion({
      specifier: versionSpecifier,
      dryRun: argv.dryRun,
      firstRelease: argv.firstRelease,
      verbose: argv.verbose,
      gitTag: isCanary ? false : !argv.local,
    });

  if (!argv.local && !isCanary) {
    await client.releaseChangelog({
      releaseGraph,
      versionData: projectsVersionData,
      version: workspaceVersion,
      dryRun: argv.dryRun,
      firstRelease: argv.firstRelease,
      verbose: argv.verbose,
    });
  }

  const publishResults = await client.releasePublish({
    releaseGraph,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    access: 'restricted', // publish privately for now
    registry: argv.local ? 'http://localhost:4873' : undefined,
    tag: isCanary ? 'canary' : 'latest',
  });

  if (!argv.dryRun) {
    console.log(
      '\n⚠️  WARNING: Do not commit the versioned package.json files. They have to be reverted after the release process.\n',
    );
  }

  process.exit(
    Object.values(publishResults).every((result) => result.code === 0) ? 0 : 1,
  );
})();

function getCurrentCommitHash(): string {
  try {
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    return hash.substring(0, 7);
  } catch (error) {
    console.error('❌ Error: Failed to get current commit hash');
    throw error;
  }
}

function getCanaryVersion(baseVersion: string, commitHash: string): string {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `${baseVersion}-canary.${yyyymmdd}-${commitHash}`;
}

function isCanaryRelease(version: string | undefined): boolean {
  return version === 'canary';
}
