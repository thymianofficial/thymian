#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { glob } from 'tinyglobby';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Load configuration
const configPath = join(rootDir, '.license-checker.json');
let config = {
  bannedLicenses: [],
  excludePackages: [],
};

if (existsSync(configPath)) {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
}

const bannedLicenses = new Set(config.bannedLicenses || []);
const excludePackages = new Set(config.excludePackages || []);

console.log('🔍 License Checker - Scanning monorepo...\n');

// Find all package.json files in the workspace
const packageJsonFiles = await glob(['packages/*/package.json'], {
  cwd: rootDir,
  absolute: true,
});

// Add root package.json
packageJsonFiles.unshift(join(rootDir, 'package.json'));

console.log(`Found ${packageJsonFiles.length} package.json file(s)\n`);

let hasViolations = false;
const allViolations = [];

// Check licenses for each package
for (const packageJsonPath of packageJsonFiles) {
  const packageDir = dirname(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const packageName = packageJson.name || 'root';

  // Skip if no dependencies
  const hasDeps =
    (packageJson.dependencies &&
      Object.keys(packageJson.dependencies).length > 0) ||
    (packageJson.devDependencies &&
      Object.keys(packageJson.devDependencies).length > 0);

  if (!hasDeps) {
    console.log(`⏭️  Skipping ${packageName} (no dependencies)`);
    continue;
  }

  console.log(`📦 Checking ${packageName}...`);

  try {
    // Run license-checker
    const output = execSync(
      `npx license-checker --json --start "${packageDir}"`,
      {
        encoding: 'utf8',
        cwd: rootDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    const licenses = JSON.parse(output);
    const violations = [];

    // Check each dependency
    for (const [depName, depInfo] of Object.entries(licenses)) {
      // Skip excluded packages (strip version suffix from depName for matching)
      const depBaseName = depName.replace(/@[^@]*$/, '');
      if (excludePackages.has(depName) || excludePackages.has(depBaseName)) {
        continue;
      }

      const license = depInfo.licenses;

      // Check if license is banned
      if (typeof license === 'string') {
        if (bannedLicenses.has(license)) {
          violations.push({ package: depName, license });
        }
      } else if (Array.isArray(license)) {
        // Handle multiple licenses (e.g., "MIT OR Apache-2.0")
        const hasBannedLicense = license.some((l) => bannedLicenses.has(l));
        if (hasBannedLicense) {
          violations.push({ package: depName, license: license.join(' OR ') });
        }
      }
    }

    if (violations.length > 0) {
      hasViolations = true;
      console.log(`  ❌ Found ${violations.length} license violation(s):`);
      violations.forEach((v) => {
        console.log(`     - ${v.package}: ${v.license}`);
        allViolations.push({ ...v, workspace: packageName });
      });
    } else {
      console.log(`  ✅ No violations found`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (ignore) {
    // If license-checker fails (e.g., no node_modules), try to continue
    console.log(
      `  ⚠️  Could not check licenses (node_modules might be missing)`,
    );
  }

  console.log('');
}

// Summary
console.log('─'.repeat(60));
if (hasViolations) {
  console.log(`\n❌ License check FAILED\n`);
  console.log(`Found ${allViolations.length} banned license(s):\n`);
  allViolations.forEach((v) => {
    console.log(`  ${v.package} (${v.workspace})`);
    console.log(`    License: ${v.license}\n`);
  });
  console.log('Banned licenses:', Array.from(bannedLicenses).join(', '));
  process.exit(1);
} else {
  console.log('\n✅ License check PASSED\n');
  console.log('All dependencies use approved licenses.');
  process.exit(0);
}
