import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface WorkspacePackage {
  name: string;
  packageDir: string;
  packageJsonPath: string;
}

interface CliArgs {
  version?: string;
  package?: string[];
  dryRun: boolean;
}

const NPM_REGISTRY = 'https://registry.npmjs.org';
const TRUSTED_PUBLISHING_WORKFLOW_FILE = 'release.yaml';
const TRUSTED_PUBLISHING_ENVIRONMENT = 'npm';

(async () => {
  const argv = await yargs(hideBin(process.argv))
    .version(false)
    .option('version', {
      alias: 'v',
      description:
        'Explicit canary version override (for example: 1.2.3-canary.20260420-abc1234)',
      type: 'string',
    })
    .option('package', {
      alias: 'p',
      description:
        'Specific @thymian package(s) to publish. If omitted, all unpublished @thymian workspace packages are used.',
      type: 'array',
      string: true,
    })
    .option('dryRun', {
      alias: 'd',
      description:
        'Print what would be published without modifying files or running npm publish',
      type: 'boolean',
      default: true,
    })
    .strict()
    .parseAsync();

  const args: CliArgs = {
    version: argv.version,
    package: argv.package,
    dryRun: argv.dryRun,
  };

  ensureNpmLogin();

  const workspacePackages = findWorkspacePackages();
  if (workspacePackages.length === 0) {
    console.error('No publishable @thymian packages found under packages/*');
    process.exit(1);
  }

  const requestedPackageNames = args.package ?? [];
  const targetPackages =
    requestedPackageNames.length > 0
      ? resolveRequestedPackages(workspacePackages, requestedPackageNames)
      : findUnpublishedPackages(workspacePackages);

  if (targetPackages.length === 0) {
    console.log('No unpublished @thymian packages found. Nothing to do.');
    process.exit(0);
  }

  const canaryVersion = resolveCanaryVersion(args.version, workspacePackages);

  console.log('Local canary publish configuration');
  console.log(`  registry: ${NPM_REGISTRY}`);
  console.log(`  canary version: ${canaryVersion}`);
  console.log(`  dryRun: ${args.dryRun}`);
  console.log('  packages:');
  for (const pkg of targetPackages) {
    console.log(`    - ${pkg.name}`);
  }
  console.log('');

  buildPackages(targetPackages);

  const failedPackages: string[] = [];
  const publishedPackages: string[] = [];

  for (const pkg of targetPackages) {
    const publishResult = publishPackageCanary(pkg, canaryVersion, args.dryRun);
    if (publishResult) {
      publishedPackages.push(pkg.name);
    } else {
      failedPackages.push(pkg.name);
    }
  }

  if (args.dryRun) {
    console.log('Dry-run completed. No package.json files were modified.');
    console.log(
      'To publish for real, run: npm run bootstrap-npm-packages -- --no-dryRun',
    );
    process.exit(failedPackages.length > 0 ? 1 : 0);
  }

  if (publishedPackages.length > 0) {
    printTrustedPublishingGuidance(publishedPackages);
  }

  if (failedPackages.length > 0) {
    console.error('Some packages failed to publish:');
    for (const pkgName of failedPackages) {
      console.error(`  - ${pkgName}`);
    }
    process.exit(1);
  }

  console.log(
    'All selected packages were published successfully with dist-tag "canary".',
  );
})();

function buildPackages(packages: WorkspacePackage[]): void {
  // Derive Nx project names from the package directory names (e.g. packages/core -> core)
  const projectNames = packages.map((pkg) => {
    const parts = pkg.packageDir.split('/');
    return parts[parts.length - 1];
  });

  const projectList = projectNames.join(',');
  console.log(`Building packages: ${projectList}`);

  try {
    execFileSync(
      'npx',
      ['nx', 'run-many', '-t', 'build', '--projects', projectList, '--no-tui'],
      { cwd: process.cwd(), stdio: 'inherit' },
    );
    console.log('Build completed successfully.\n');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Build failed: ${message}`);
    process.exit(1);
  }
}

function ensureNpmLogin(): void {
  try {
    const user = execFileSync('npm', ['whoami'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

    if (!user) {
      throw new Error('npm whoami returned an empty user');
    }

    console.log(`Using npm account: ${user}`);
  } catch {
    console.error('You are not logged in to npm.');
    console.error('Run "npm login" and then rerun this script.');
    process.exit(1);
  }
}

function findWorkspacePackages(): WorkspacePackage[] {
  const packagesRoot = join(process.cwd(), 'packages');

  if (!existsSync(packagesRoot)) {
    return [];
  }

  const dirs = readdirSync(packagesRoot, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  );

  const result: WorkspacePackage[] = [];

  for (const dir of dirs) {
    const packageDir = join(packagesRoot, dir.name);
    const packageJsonPath = join(packageDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = readJsonFile(packageJsonPath) as {
      name?: string;
      private?: boolean;
    };

    if (!packageJson.name?.startsWith('@thymian/')) {
      continue;
    }

    if (packageJson.private === true) {
      continue;
    }

    result.push({
      name: packageJson.name,
      packageDir,
      packageJsonPath,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveRequestedPackages(
  workspacePackages: WorkspacePackage[],
  requestedNames: string[],
): WorkspacePackage[] {
  const packageByName = new Map(
    workspacePackages.map((pkg) => [pkg.name, pkg]),
  );
  const resolved: WorkspacePackage[] = [];

  for (const name of requestedNames) {
    const pkg = packageByName.get(name);
    if (!pkg) {
      console.error(`Requested package not found in workspace: ${name}`);
      process.exit(1);
    }
    resolved.push(pkg);
  }

  return resolved;
}

function findUnpublishedPackages(
  workspacePackages: WorkspacePackage[],
): WorkspacePackage[] {
  const unpublished: WorkspacePackage[] = [];

  for (const pkg of workspacePackages) {
    if (!isPublishedOnNpm(pkg.name)) {
      unpublished.push(pkg);
    }
  }

  return unpublished;
}

function resolveCanaryVersion(
  overriddenVersion: string | undefined,
  workspacePackages: WorkspacePackage[],
): string {
  if (overriddenVersion) {
    if (!isCanaryVersion(overriddenVersion)) {
      console.error(`Invalid --version value: ${overriddenVersion}`);
      console.error(
        'Expected a canary version (for example: 1.2.3-canary.20260420-abc1234)',
      );
      process.exit(1);
    }
    assertNoPlaceholder(overriddenVersion, '--version override');
    return overriddenVersion;
  }

  const canaryVersions: string[] = [];

  for (const pkg of workspacePackages) {
    const canaryTag = getNpmDistTag(pkg.name, 'canary');
    if (canaryTag && isCanaryVersion(canaryTag)) {
      canaryVersions.push(canaryTag);
    }
  }

  if (canaryVersions.length === 0) {
    console.error(
      'Could not determine a default canary version from npm dist-tags.',
    );
    console.error('Use --version to provide a canary version override.');
    process.exit(1);
  }

  canaryVersions.sort(compareCanaryVersionsDesc);
  const resolved = canaryVersions[0];
  assertNoPlaceholder(resolved, 'resolved canary version');
  return resolved;
}

function publishPackageCanary(
  pkg: WorkspacePackage,
  canaryVersion: string,
  dryRun: boolean,
): boolean {
  const packageJsonRaw = readFileSync(pkg.packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw) as Record<string, unknown>;

  const distDir = join(pkg.packageDir, 'dist');
  if (!existsSync(distDir)) {
    console.error(`Skipping ${pkg.name}: missing ${distDir}`);
    console.error(
      'Build the package first so npm publish can include compiled artifacts from dist/.',
    );
    return false;
  }

  patchPackageJsonForCanary(packageJson, canaryVersion);

  if (dryRun) {
    console.log(
      `[dry-run] Would publish ${pkg.name}@${canaryVersion} with tag "canary"`,
    );
    return true;
  }

  // Final safety: abort if any PLACEHOLDER leaked into the file we are about to publish
  const serialized = JSON.stringify(packageJson, null, 2);
  if (serialized.includes('PLACEHOLDER')) {
    console.error(
      `Aborting publish of ${pkg.name}: package.json still contains a PLACEHOLDER value after patching.`,
    );
    return false;
  }

  writeFileSync(pkg.packageJsonPath, `${serialized}\n`, 'utf8');

  try {
    console.log(`Publishing ${pkg.name}@${canaryVersion} ...`);
    execFileSync(
      'npm',
      [
        'publish',
        '--tag',
        'canary',
        '--access',
        'public',
        '--registry',
        NPM_REGISTRY,
      ],
      {
        cwd: pkg.packageDir,
        stdio: 'inherit',
      },
    );
    console.log(`Published ${pkg.name}@${canaryVersion}`);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to publish ${pkg.name}: ${message}`);
    return false;
  } finally {
    writeFileSync(pkg.packageJsonPath, packageJsonRaw, 'utf8');
  }
}

function patchPackageJsonForCanary(
  packageJson: Record<string, unknown>,
  canaryVersion: string,
): void {
  packageJson.version = canaryVersion;

  const depSections: Array<
    | 'dependencies'
    | 'devDependencies'
    | 'peerDependencies'
    | 'optionalDependencies'
  > = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  for (const section of depSections) {
    const deps = packageJson[section];
    if (!deps || typeof deps !== 'object') {
      continue;
    }

    for (const [name, value] of Object.entries(deps)) {
      if (!name.startsWith('@thymian/')) {
        continue;
      }

      if (typeof value !== 'string') {
        continue;
      }

      // Normalize internal references so npm can resolve dependencies consistently.
      (deps as Record<string, string>)[name] = canaryVersion;
    }
  }
}

function isPublishedOnNpm(packageName: string): boolean {
  try {
    execFileSync('npm', ['view', packageName, 'version', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return true;
  } catch (error: unknown) {
    const stderr = getErrorStderr(error);
    if (stderr.includes('E404') || stderr.includes('404')) {
      return false;
    }

    throw error;
  }
}

function getNpmDistTag(
  packageName: string,
  distTag: string,
): string | undefined {
  try {
    const output = execFileSync(
      'npm',
      ['view', packageName, `dist-tags.${distTag}`, '--json'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      },
    ).trim();

    if (!output || output === 'null') {
      return undefined;
    }

    const parsed = JSON.parse(output) as unknown;
    return typeof parsed === 'string' ? parsed : undefined;
  } catch (error: unknown) {
    const stderr = getErrorStderr(error);
    if (stderr.includes('E404') || stderr.includes('404')) {
      return undefined;
    }

    return undefined;
  }
}

function isCanaryVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+-canary\.\d{8}-[0-9a-z]+$/i.test(version);
}

function compareCanaryVersionsDesc(a: string, b: string): number {
  return -compareCanaryVersionsAsc(a, b);
}

function compareCanaryVersionsAsc(a: string, b: string): number {
  const parsedA = parseCanaryVersion(a);
  const parsedB = parseCanaryVersion(b);

  if (!parsedA || !parsedB) {
    return a.localeCompare(b);
  }

  if (parsedA.major !== parsedB.major) {
    return parsedA.major - parsedB.major;
  }

  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor - parsedB.minor;
  }

  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch - parsedB.patch;
  }

  if (parsedA.date !== parsedB.date) {
    return parsedA.date.localeCompare(parsedB.date);
  }

  return parsedA.hash.localeCompare(parsedB.hash);
}

function parseCanaryVersion(version: string):
  | {
      major: number;
      minor: number;
      patch: number;
      date: string;
      hash: string;
    }
  | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)-canary\.(\d{8})-([0-9a-z]+)$/i.exec(
    version,
  );
  if (!match) {
    return undefined;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    date: match[4],
    hash: match[5].toLowerCase(),
  };
}

function printTrustedPublishingGuidance(publishedPackages: string[]): void {
  const repo = getGitHubRepository();

  console.log('');
  console.log(
    'Next step: configure npm trusted publishing for each new package',
  );
  console.log(
    'Use the package settings page and add a Trusted Publisher with these values:',
  );
  console.log(`  provider: GitHub Actions`);
  console.log(`  repository owner: ${repo?.owner ?? '<your-github-owner>'}`);
  console.log(`  repository name: ${repo?.name ?? '<your-repository-name>'}`);
  console.log(`  workflow file: ${TRUSTED_PUBLISHING_WORKFLOW_FILE}`);
  console.log(`  environment name: ${TRUSTED_PUBLISHING_ENVIRONMENT}`);
  console.log('');

  for (const packageName of publishedPackages) {
    const settingsLink = `https://www.npmjs.com/package/${encodeURIComponent(packageName)}/access`;
    console.log(`  - ${packageName}`);
    console.log(`    ${settingsLink}`);
  }

  console.log('');
  console.log(
    'In the npm UI, open each link above and fill the Trusted Publisher form with the same values.',
  );
  console.log(
    'After saving, CI can publish future releases through OIDC without npm tokens.',
  );
}

function getGitHubRepository(): { owner: string; name: string } | undefined {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      encoding: 'utf8',
    }).trim();

    const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(
      remoteUrl,
    );
    if (sshMatch) {
      return { owner: sshMatch[1], name: sshMatch[2] };
    }

    const httpsMatch =
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(remoteUrl);
    if (httpsMatch) {
      return { owner: httpsMatch[1], name: httpsMatch[2] };
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function getErrorStderr(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }

  const stderr = (error as { stderr?: unknown }).stderr;

  if (typeof stderr === 'string') {
    return stderr;
  }

  if (Buffer.isBuffer(stderr)) {
    return stderr.toString('utf8');
  }

  return '';
}

function assertNoPlaceholder(value: string, label: string): void {
  if (value.includes('PLACEHOLDER')) {
    console.error(`Aborting: ${label} contains PLACEHOLDER ("${value}").`);
    console.error('PLACEHOLDER versions must never be published to npm.');
    process.exit(1);
  }
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}
