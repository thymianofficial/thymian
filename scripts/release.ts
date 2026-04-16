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

type ReleaseMode = 'canary' | 'latest' | 'ci-publish' | 'local';
type DistTag = 'canary' | 'latest';

interface ValidatedArguments {
  mode: ReleaseMode;
  distTag: DistTag;
  version: string | undefined;
  dryRun: boolean;
  firstRelease: boolean;
  verbose: boolean;
  local: boolean;
  skipPublish: boolean;
}

/**
 * Validates argument combinations and determines the release mode.
 * Rejects invalid combinations with clear error messages.
 */
function validateAndDetermineMode(argv: {
  distTag: DistTag;
  version?: string;
  dryRun: boolean;
  firstRelease: boolean;
  verbose: boolean;
  local: boolean;
  skipPublish: boolean;
}): ValidatedArguments {
  const isCanary = argv.distTag === 'canary';
  const isLatest = argv.distTag === 'latest';
  const inCI = isInCI();

  // Reject: canary with local flag
  if (isCanary && argv.local) {
    console.error('❌ Error: Invalid argument combination');
    console.error('   --dist-tag canary --local');
    console.error(
      '   Problem: Canary releases are for npm, not local testing.\n',
    );
    process.exit(1);
  }

  // Reject: latest in CI without explicit version (CI must provide version from git tag)
  if (isLatest && inCI && !argv.version) {
    console.error('❌ Error: Invalid argument combination');
    console.error('   --dist-tag latest in CI environment without --version');
    console.error(
      '   Problem: CI must provide explicit version from git tag.\n',
    );
    process.exit(1);
  }

  // Note: --dist-tag latest --no-local outside CI is allowed.
  // The 'latest' mode only creates a git tag + GitHub Release.
  // Actual npm publishing is handled by CI when it picks up the GitHub Release event.

  // Determine mode
  let mode: ReleaseMode;
  if (isCanary && !argv.local) {
    mode = 'canary';
  } else if (isLatest && !argv.local && !inCI) {
    // Interactive latest release (creates tag + GitHub Release, no publish)
    mode = 'latest';
  } else if (inCI && !argv.local) {
    mode = 'ci-publish';
  } else {
    mode = 'local';
  }

  return {
    mode,
    distTag: argv.distTag,
    version: argv.version,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    local: argv.local,
    skipPublish: argv.skipPublish,
  };
}

/**
 * Runs a canary release workflow.
 * - Determines version from conventional commits
 * - Generates canary version string with date and commit hash
 * - Versions packages without git tag
 * - Publishes with 'canary' dist-tag
 */
async function runCanaryRelease(
  client: ReleaseClient,
  argv: ValidatedArguments,
): Promise<void> {
  console.log('\n🐤 CANARY RELEASE MODE\n');

  let baseVersion: string;

  // If explicit version provided, use it as base; otherwise derive from conventional commits
  if (argv.version) {
    console.log(`📦 Using explicit base version: ${argv.version}\n`);
    baseVersion = argv.version;
  } else {
    console.log('🔍 Determining next version from conventional commits...\n');

    // Dry-run to get base version
    const { workspaceVersion: nextVersion } = await client.releaseVersion({
      specifier: undefined,
      dryRun: true,
      firstRelease: argv.firstRelease,
      verbose: argv.verbose,
      gitTag: false,
    });

    if (!nextVersion) {
      // No conventional-commit bump detected — fall back to current latest tag
      // so canary builds on branches still get a meaningful version.
      const fallback = execSync(
        'git describe --tags --abbrev=0 2>/dev/null || echo "0.0.0"',
      )
        .toString()
        .trim()
        .replace(/^v/, '');
      console.log(
        `ℹ️  No conventional-commit bump detected. Using latest tag as base: ${fallback}\n`,
      );
      baseVersion = fallback;
    } else {
      baseVersion = nextVersion;
    }
  }

  const commitHash = getCurrentCommitHash();
  const canaryVersionString = getCanaryVersion(baseVersion, commitHash);

  console.log(`📦 Canary version: ${canaryVersionString}`);
  console.log(`   Base version: ${baseVersion}`);
  console.log(`   Commit hash: ${commitHash}\n`);

  // Version packages
  const { releaseGraph } = await client.releaseVersion({
    specifier: canaryVersionString,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    gitTag: false,
  });

  // Publish with canary dist-tag (no changelog for canary)
  const publishResults = await client.releasePublish({
    releaseGraph,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    access: 'public',
    registry: argv.local ? 'http://localhost:4873' : undefined,
    tag: argv.distTag,
  });

  if (argv.dryRun) {
    console.log(
      '\n📋 DRY-RUN MODE: This was a dry-run. No changes were made.\n',
    );
  } else {
    console.log('\n✅ Canary release published successfully!\n');
  }

  process.exit(
    Object.values(publishResults).every((result) => result.code === 0) ? 0 : 1,
  );
}

/**
 * Runs a latest release workflow.
 * - Determines version from conventional commits
 * - Generates and previews changelog
 * - Prompts for user confirmation (if interactive)
 * - Creates git tag and GitHub Release
 * - Exits without publishing (GitHub Release triggers CI)
 */
async function runLatestRelease(
  client: ReleaseClient,
  argv: ValidatedArguments,
): Promise<void> {
  console.log('\n🚀 LATEST RELEASE MODE\n');

  // If explicit version provided, use it; otherwise derive from conventional commits
  const versionSpecifier = argv.version ?? undefined;
  if (argv.version) {
    console.log(`📦 Using explicit version: ${argv.version}\n`);
  } else {
    console.log('🔍 Determining next version from conventional commits...\n');
  }

  // Preview release to get version info
  const previewResult = await client.releaseVersion({
    specifier: versionSpecifier,
    dryRun: true,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    gitTag: false,
  });

  if (!previewResult.workspaceVersion) {
    console.error('❌ Error: Could not determine workspace version');
    process.exit(1);
  }

  // Generate and display changelog preview
  console.log('\n📋 Changelog Preview:\n');
  await client.releaseChangelog({
    releaseGraph: previewResult.releaseGraph,
    versionData: previewResult.projectsVersionData,
    version: previewResult.workspaceVersion,
    dryRun: true,
    firstRelease: argv.firstRelease,
    verbose: true,
  });

  // Prompt for confirmation (interactive mode only)
  if (!argv.dryRun) {
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

  // Version packages with git tag
  const { workspaceVersion, projectsVersionData, releaseGraph } =
    await client.releaseVersion({
      specifier: argv.version ?? undefined, // Use explicit version if provided
      dryRun: argv.dryRun,
      firstRelease: argv.firstRelease,
      verbose: argv.verbose,
      gitTag: true, // Create git tag
    });

  // Generate actual changelog and GitHub Release
  await client.releaseChangelog({
    releaseGraph,
    versionData: projectsVersionData,
    version: workspaceVersion,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
  });

  // Exit without publishing - GitHub Release will trigger CI
  if (argv.dryRun) {
    console.log('\n📋 DRY-RUN MODE: No changes were made.');
    console.log(
      '   In actual run: Tag and GitHub Release would be created, triggering CI to publish to npm.\n',
    );
  } else {
    console.log('\n✅ Tag and GitHub Release created successfully!');
    console.log('   Publishing to npm will be triggered by GitHub Release.\n');
  }

  process.exit(0);
}

/**
 * Runs a CI publish release workflow.
 * - Validates GitHub actor against allowlist
 * - Validates exact semver version
 * - Versions packages without git tag
 * - Publishes with 'latest' dist-tag to npm
 */
async function runCIPublishRelease(
  client: ReleaseClient,
  argv: ValidatedArguments,
): Promise<void> {
  console.log('\n📋 CI PUBLISH MODE\n');

  // Validate exact semver version
  const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$/i;
  if (!argv.version || !semverRegex.test(argv.version)) {
    console.error('❌ Error: CI publish mode requires exact semver version');
    console.error(`   Received: ${argv.version || 'undefined'}`);
    console.error('   Expected: exact semver (e.g., 1.2.3, 1.0.0-beta.1)');
    process.exit(1);
  }

  // Validate GitHub actor
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
  console.log(`   Version: ${argv.version}\n`);

  // Version packages without git tag (tag already exists from local release)
  const { releaseGraph } = await client.releaseVersion({
    specifier: argv.version,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    gitTag: false,
  });

  if (argv.skipPublish) {
    console.log(
      '\n📋 SKIP-PUBLISH: Versioning complete. Skipping NX publish — publishing handled externally.\n',
    );
    process.exit(0);
  }

  // Publish to npm (skip changelog - already created during local release)
  const publishResults = await client.releasePublish({
    releaseGraph,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    access: 'public',
    registry: undefined, // Use npm
    tag: argv.distTag,
  });

  if (argv.dryRun) {
    console.log(
      '\n📋 DRY-RUN MODE: This was a dry-run. No changes were made.\n',
    );
  } else {
    console.log('\n✅ Published to npm successfully!\n');
  }

  process.exit(
    Object.values(publishResults).every((result) => result.code === 0) ? 0 : 1,
  );
}

/**
 * Runs a local release workflow for testing.
 * - Checks Verdaccio is running
 * - Versions packages without git tag
 * - Publishes with dist-tag to local registry
 */
async function runLocalRelease(
  client: ReleaseClient,
  argv: ValidatedArguments,
): Promise<void> {
  console.log('\n📋 LOCAL RELEASE MODE\n');

  // Check Verdaccio is running
  if (!argv.dryRun) {
    const isRunning = await isVerdaccioRunning('http://localhost:4873/');
    if (!isRunning) {
      console.error(
        '❌ Error: Local verdaccio is not running on http://localhost:4873/',
      );
      console.error('Please start verdaccio with: npm run local-registry');
      process.exit(1);
    }
    console.log('✅ Verdaccio is running\n');
  }

  // Determine version specifier - apply canary postfix if needed
  let versionSpecifier = argv.version;
  if (argv.distTag === 'canary' && argv.version) {
    const commitHash = getCurrentCommitHash();
    versionSpecifier = getCanaryVersion(argv.version, commitHash);
    console.log(`📦 Local canary version: ${versionSpecifier}\n`);
  }

  // Version packages
  const { releaseGraph } = await client.releaseVersion({
    specifier: versionSpecifier,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    gitTag: false,
  });

  // Publish to local registry (no changelog for local testing)
  const publishResults = await client.releasePublish({
    releaseGraph,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    access: 'public',
    registry: 'http://localhost:4873',
    tag: argv.distTag,
  });

  if (argv.dryRun) {
    console.log(
      '\n📋 DRY-RUN MODE: This was a dry-run. No changes were made.\n',
    );
  } else {
    console.log('\n✅ Published to local registry successfully!');
    console.log(
      '\n⚠️  WARNING: Do not commit the versioned package.json files. They have to be reverted after the release process.\n',
    );
  }

  process.exit(
    Object.values(publishResults).every((result) => result.code === 0) ? 0 : 1,
  );
}

/**
 * Main function: parses arguments, validates mode, and dispatches to appropriate handler.
 */
(async () => {
  const argv = await yargs(hideBin(process.argv))
    .version(false)
    .option('dist-tag', {
      alias: 't',
      description: 'npm dist-tag to publish with (canary or latest)',
      type: 'string',
      choices: ['canary', 'latest'] as const,
      demandOption: true,
    })
    .option('version', {
      alias: 'v',
      description:
        'Explicit version specifier (e.g., 1.2.3, patch, minor, major). If omitted, version is derived from conventional commits.',
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
    .option('skipPublish', {
      description:
        'Skip the NX publish step after versioning. Use for trusted publishing where npm publish is called directly.',
      type: 'boolean',
      default: false,
    })
    .parseAsync();

  // Validate arguments and determine mode
  const validatedArgs = validateAndDetermineMode({
    distTag: argv['dist-tag'],
    version: argv.version,
    dryRun: argv.dryRun,
    firstRelease: argv.firstRelease,
    verbose: argv.verbose,
    local: argv.local,
    skipPublish: argv.skipPublish,
  });

  // Display configuration
  const modeEmoji = {
    canary: '🐤',
    latest: '🚀',
    'ci-publish': '📋',
    local: '📋',
  };

  console.log(`\n${modeEmoji[validatedArgs.mode]} Release Configuration:`);
  console.log(`  mode: ${validatedArgs.mode.toUpperCase()}`);
  console.log(`  dist-tag: ${validatedArgs.distTag}`);
  console.log(`  version: ${validatedArgs.version || 'conventional commits'}`);
  console.log(`  dryRun: ${validatedArgs.dryRun}`);
  console.log(`  firstRelease: ${validatedArgs.firstRelease}`);
  console.log(`  verbose: ${validatedArgs.verbose}`);
  console.log(`  local: ${validatedArgs.local}`);
  console.log(
    `  registry: ${validatedArgs.local ? 'http://localhost:4873' : 'npm'}\n`,
  );

  // Create client and dispatch to mode-specific handler
  const client = new ReleaseClient({});

  switch (validatedArgs.mode) {
    case 'canary':
      await runCanaryRelease(client, validatedArgs);
      break;
    case 'latest':
      await runLatestRelease(client, validatedArgs);
      break;
    case 'ci-publish':
      await runCIPublishRelease(client, validatedArgs);
      break;
    case 'local':
      await runLocalRelease(client, validatedArgs);
      break;
  }
})();

// ============================================================================
// Helper Functions
// ============================================================================

function isInCI(): boolean {
  return process.env.GITHUB_ACTIONS === 'true';
}

async function isVerdaccioRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
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
      '🤔 Do you want to proceed with this release? (yes/no or y/n): ',
    );
    return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

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
