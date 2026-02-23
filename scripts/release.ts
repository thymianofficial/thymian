import { execSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

import { ReleaseClient } from 'nx/release/index.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Allowlist of GitHub usernames authorized to publish latest releases
const VALID_AUTHORS_FOR_LATEST: string[] = [
  'matthyk', // Matthias Keckl
  'Markus-Ende', // Markus Ende
  'BaggersIO', // Peter Müller
  'atennert', // Andreas Tennert
];

async function isVerdaccioRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

function isInCI(): boolean {
  return process.env.GITHUB_ACTIONS === 'true';
}

function validateCIPublishMode(
  version: string | undefined,
  isLocal: boolean,
): void {
  // CI publish-only mode validation
  if (!isInCI() || isLocal) {
    return; // Not in CI or local mode - skip validation
  }

  // Require exact semver version in CI
  const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$/i;
  if (!version || !semverRegex.test(version)) {
    console.error('❌ Error: CI publish mode requires exact semver version');
    console.error(`   Received: ${version || 'undefined'}`);
    console.error('   Expected: exact semver (e.g., 1.2.3, 1.0.0-beta.1)');
    process.exit(1);
  }

  // Validate registry is not localhost
  if (isLocal) {
    console.error('❌ Error: CI publish mode cannot use local registry');
    process.exit(1);
  }

  // Validate GitHub actor against allowlist
  const actor = process.env.GITHUB_ACTOR;
  if (!actor) {
    console.error('❌ Error: GITHUB_ACTOR not set in CI environment');
    process.exit(1);
  }

  if (!VALID_AUTHORS_FOR_LATEST.includes(actor)) {
    console.error('❌ Error: Unauthorized user for latest release');
    console.error(`   User: ${actor}`);
    console.error(
      `   Allowed users: ${VALID_AUTHORS_FOR_LATEST.join(', ') || 'none configured'}`,
    );
    process.exit(1);
  }

  console.log('✅ CI publish mode validation passed');
  console.log(`   User: ${actor}`);
  console.log(`   Version: ${version}\n`);
}

async function promptUserConfirmation(
  version: string,
  projectsVersionData: Record<string, { newVersion: string }>,
): Promise<boolean> {
  console.log('\n' + '='.repeat(60));
  console.log('📦 RELEASE SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n🏷️  Version: ${version}\n`);

  // Display projects and versions
  if (projectsVersionData) {
    console.log('📝 Projects to be released:');
    for (const [project, data] of Object.entries(projectsVersionData)) {
      console.log(`   • ${project}: ${data.newVersion}`);
    }
    console.log();
  }

  console.log('This will:');
  console.log('  1. Create a git tag for this version');
  console.log('  2. Create a GitHub Release');
  console.log('  3. Trigger CI to publish to npm (requires approval)\n');
  console.log('='.repeat(60) + '\n');

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      '🤔 Do you want to proceed with this release? (yes/no): ',
    );
    return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
  } finally {
    rl.close();
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
  const isLatest = argv.version === 'latest';
  const isCIPublishMode = isInCI() && !argv.local;

  // Validate CI publish-only mode (skip for canary and dry-runs)
  if (isCIPublishMode && !isCanary && !argv.dryRun) {
    validateCIPublishMode(argv.version, argv.local);
  }

  let mode = 'STANDARD';
  if (isCanary) {
    mode = 'CANARY';
  } else if (isLatest) {
    mode = 'LATEST';
  } else if (isCIPublishMode) {
    mode = 'CI-PUBLISH';
  }

  console.log(
    `\n${isCanary ? '🐤' : isLatest ? '🚀' : '📋'} Release Configuration:`,
  );
  console.log(`  mode: ${mode}`);
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

  // For latest releases, use conventional commits to determine version
  if (isLatest) {
    console.log('🔍 Determining next version from conventional commits...\n');
    versionSpecifier = undefined; // Let conventional commits determine version

    // Interactive confirmation for latest releases (local only, not dry-run)
    // Run a dry-run first to get version info, then prompt, then execute
    if (!argv.local && !argv.dryRun && !isInCI()) {
      const previewResult = await client.releaseVersion({
        specifier: versionSpecifier,
        dryRun: true, // Preview only
        firstRelease: argv.firstRelease,
        verbose: argv.verbose,
        gitTag: false,
      });

      if (!previewResult.workspaceVersion) {
        console.error('❌ Error: Could not determine workspace version');
        process.exit(1);
      }

      // Generate changelog preview (prints to console)
      console.log('\n📋 Changelog Preview:\n');
      await client.releaseChangelog({
        releaseGraph: previewResult.releaseGraph,
        versionData: previewResult.projectsVersionData,
        version: previewResult.workspaceVersion,
        dryRun: true, // Preview mode - output to console only
        firstRelease: argv.firstRelease,
        verbose: true, // Show the full changelog output
      });

      const confirmed = await promptUserConfirmation(
        previewResult.workspaceVersion,
        previewResult.projectsVersionData as Record<
          string,
          { newVersion: string }
        >,
      );

      if (!confirmed) {
        console.log('\n❌ Release cancelled by user.\n');
        process.exit(0);
      }

      console.log('\n✅ Release confirmed. Proceeding...\n');
    }
  }

  const { workspaceVersion, projectsVersionData, releaseGraph } =
    await client.releaseVersion({
      specifier: versionSpecifier,
      dryRun: argv.dryRun,
      firstRelease: argv.firstRelease,
      verbose: argv.verbose,
      gitTag: isCanary ? false : !argv.local,
    });

  // Create changelog for non-local, non-canary releases
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

  // Skip publish for latest releases (will be triggered by GitHub Release)
  if (isLatest && !argv.local) {
    console.log('\n✅ Tag and GitHub Release created successfully!');
    console.log('   Publishing to npm will be triggered by GitHub Release.\n');
    process.exit(0);
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
