// Regenerates (or, with `--check`, verifies without writing) a spec
// package's coverage section of its own README.md, via core's renderer and
// checker (`@thymian/core`) — no second implementation of either. Follows
// the existing generator precedent (`generate-schema-docs.js`,
// `generate-rule-tags-docs.js`): a workspace script that imports the built
// package, invoked from a per-package nx target that depends on `build`.
//
// Usage: node scripts/generate-coverage.ts <package-name> [--check]
//
// A package whose rule set carries no `coverage` (ADR-0021 §5: a
// self-referential package legitimately carries none) is a clean no-op,
// not an error — this is expected to run against every spec package
// uniformly, most of which may not have adopted a coverage record yet.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// A type-only import is erased at compile time — no runtime `import`, so
// `@nx/enforce-module-boundaries`'s lazy-load rule for `core` (this is a
// root script, outside the project graph's dependency-ordered build) never
// sees it. The values (`checkCoverage`, `isRuleSet`, `loadRules`,
// `renderCoverage`) are loaded dynamically in `main`, matching
// `generate-rule-tags-docs.js`/`generate-impossibility-docs.js`'s existing
// precedent for the same constraint.
import type { Rule } from '@thymian/core';
import * as prettier from 'prettier';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Mirrors the HEADER/FOOTER convention every package README already uses
// (`<!-- HEADER:START ... -->` / `<!-- HEADER:END -->`) — the precedent
// ADR-0021 §5 names for putting generated content inside README.md.
const MARKER_START = '<!-- COVERAGE:START';
const MARKER_END = '<!-- COVERAGE:END -->';

interface Region {
  before: string;
  after: string;
}

// Finds the region between the coverage markers. `undefined` means the
// markers are missing entirely — the caller refuses rather than appending
// or silently doing nothing (the acceptance criterion this exists for).
function findMarkerRegion(readme: string): Region | undefined {
  const startIndex = readme.indexOf(MARKER_START);
  if (startIndex === -1) {
    return undefined;
  }
  const startLineEnd = readme.indexOf('\n', startIndex);
  if (startLineEnd === -1) {
    return undefined;
  }
  const endIndex = readme.indexOf(MARKER_END, startLineEnd);
  if (endIndex === -1) {
    return undefined;
  }

  return {
    before: readme.slice(0, startLineEnd + 1),
    after: readme.slice(endIndex),
  };
}

function currentGeneratedBlock(readme: string, region: Region): string {
  return readme.slice(
    region.before.length,
    readme.length - region.after.length,
  );
}

// Finds the workspace package directory for an `@thymian/*` name by
// reading every `packages/*/package.json`'s own `name` field — the same
// approach `scripts/bootstrap-npm-packages.ts` uses, rather than resolving
// through node_modules, so this works whether or not the package has been
// `npm install`-linked under that exact path.
function findPackageDir(pkgName: string, cwd: string): string | undefined {
  const packagesRoot = join(cwd, 'packages');
  if (!existsSync(packagesRoot)) {
    return undefined;
  }

  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageJsonPath = join(packagesRoot, entry.name, 'package.json');
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      name?: string;
    };
    if (packageJson.name === pkgName) {
      return join(packagesRoot, entry.name);
    }
  }
  return undefined;
}

// Every rule's topic directory, keyed by rule name — derived by walking
// the *built* package's own rule files and importing each one directly,
// since neither `loadRules`'s output (`Rule[]`, no source path) nor
// `RuleMeta` carries a rule's topic. Mirrors `RuleSet.pattern`
// (`rules/**/*.rule.js`): the first path segment under the pattern's own
// root directory is the topic, matching the source layout the add-http-
// rule-set skill already establishes (`src/rules/<topic>/<name>.rule.ts`).
async function discoverTopics(
  distDir: string,
  pattern: string | string[] | undefined,
): Promise<Map<string, string>> {
  const topicByRuleName = new Map<string, string>();
  const patterns =
    pattern === undefined ? [] : ([] as string[]).concat(pattern);

  for (const onePattern of patterns) {
    // Root: everything before the first glob metacharacter.
    const globStart = onePattern.search(/[*?[{]/);
    const root = globStart === -1 ? onePattern : onePattern.slice(0, globStart);
    const rulesRoot = join(distDir, root.replace(/\/$/, ''));
    if (!existsSync(rulesRoot)) {
      continue;
    }

    for (const topicEntry of readdirSync(rulesRoot, { withFileTypes: true })) {
      if (!topicEntry.isDirectory()) {
        continue;
      }
      const topicDir = join(rulesRoot, topicEntry.name);
      for (const fileEntry of readdirSync(topicDir, {
        withFileTypes: true,
        recursive: true,
      })) {
        if (!fileEntry.isFile() || !fileEntry.name.endsWith('.rule.js')) {
          continue;
        }
        const filePath = join(fileEntry.parentPath, fileEntry.name);
        const module: unknown = await import(pathToFileURL(filePath).href);
        const ruleName = (module as { default?: { meta?: { name?: string } } })
          .default?.meta?.name;
        if (typeof ruleName === 'string') {
          topicByRuleName.set(ruleName, topicEntry.name);
        }
      }
    }
  }
  return topicByRuleName;
}

function groupByTopic(
  rules: readonly Rule[],
  topicByRuleName: Map<string, string>,
): Record<string, Rule[]> {
  const grouped: Record<string, Rule[]> = {};
  for (const rule of rules) {
    const topic = topicByRuleName.get(rule.meta.name) ?? '(uncategorised)';
    (grouped[topic] ??= []).push(rule);
  }
  return grouped;
}

// A profile name that can never collide with a real one (profile names are
// author-chosen identifiers with no reserved-word list), used so
// `resolveProfileConfig`'s own documented fallback — an unknown profile
// name resolves to an empty override map — gives the one load this script
// cannot get any other way: every rule at its literal shipped `meta`, no
// profile or user config applied. That baseline is what `checkCoverage`'s
// stamp comparison and citation-requirement assertions need.
const BASELINE_PROFILE_SENTINEL = '__thymian_generate_coverage_baseline__';

async function main(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .command(
      '$0 <package>',
      "Regenerate or check a package's coverage README section",
    )
    .positional('package', {
      describe: 'The @thymian/* package name, e.g. @thymian/rules-rfc-9110',
      type: 'string',
      demandOption: true,
    })
    .option('check', {
      describe: 'Report violations and README drift without writing anything',
      type: 'boolean',
      default: false,
    })
    .strict()
    .parseAsync();

  const { checkCoverage, isRuleSet, loadRules, renderCoverage } =
    await import('@thymian/core');

  const pkgName = argv.package;
  const cwd = process.cwd();

  const packageDir = findPackageDir(pkgName, cwd);
  if (packageDir === undefined) {
    console.error(
      `❌ No workspace package named "${pkgName}" under packages/.`,
    );
    process.exit(1);
  }

  const imported: unknown = await import(pkgName);
  const ruleSet = (imported as { default?: unknown }).default;

  if (!isRuleSet(ruleSet) || ruleSet.coverage === undefined) {
    console.log(
      `ℹ️  ${pkgName} carries no coverage record — nothing to generate.`,
    );
    return;
  }

  const readmePath = join(packageDir, 'README.md');
  if (!existsSync(readmePath)) {
    console.error(`❌ ${pkgName} has no README.md at ${readmePath}.`);
    process.exit(1);
  }
  const readme = readFileSync(readmePath, 'utf-8');
  const region = findMarkerRegion(readme);
  if (region === undefined) {
    console.error(
      `❌ ${readmePath} has no coverage markers. Add:\n` +
        `   ${MARKER_START} - Generated by \`nx run <pkg>:generate-coverage\`. Do not edit by hand. -->\n` +
        `   ${MARKER_END}\n` +
        `around the region this command should own, then run this again.`,
    );
    process.exit(1);
  }

  const [baselineRules, ...profileEntries] = await Promise.all([
    loadRules(pkgName, undefined, {}, cwd, {
      [pkgName]: BASELINE_PROFILE_SENTINEL,
    }),
    ...Object.keys(ruleSet.profiles ?? {}).map(async (profileName) => {
      const rules = await loadRules(pkgName, undefined, {}, cwd, {
        [pkgName]: profileName,
      });
      return [profileName, rules] as const;
    }),
  ]);
  const profiles = Object.fromEntries(profileEntries as [string, Rule[]][]);

  const distDir = join(packageDir, 'dist');
  const topicByRuleName = await discoverTopics(distDir, ruleSet.pattern);
  const rulesByTopic = groupByTopic(baselineRules, topicByRuleName);

  const rendered = renderCoverage({
    record: ruleSet.coverage,
    rulesByTopic,
    profiles,
  });

  const prettierConfig = await prettier.resolveConfig(readmePath);
  const formatted = (
    await prettier.format(rendered, {
      ...prettierConfig,
      parser: 'markdown',
    })
  ).trimEnd();

  const currentBlock = currentGeneratedBlock(readme, region).trim();

  if (argv.check) {
    const violations = checkCoverage({
      record: ruleSet.coverage,
      rules: baselineRules,
      profiles: ruleSet.profiles ?? {},
      readme: { committed: currentBlock, generated: formatted },
    });

    if (violations.length === 0) {
      console.log(`✅ ${pkgName} coverage is up to date.`);
      return;
    }

    console.error(
      `❌ ${pkgName} coverage check found ${violations.length} problem(s):\n`,
    );
    for (const violation of violations) {
      console.error(`  [${violation.code}] ${violation.message}`);
    }
    if (currentBlock !== formatted) {
      console.error('\n--- committed ---');
      console.error(currentBlock);
      console.error('\n--- generated ---');
      console.error(formatted);
    }
    process.exit(1);
  }

  if (currentBlock === formatted) {
    console.log(
      `✅ ${pkgName} coverage is already up to date. Nothing written.`,
    );
    return;
  }

  const nextReadme = `${region.before}\n${formatted}\n\n${region.after}`;
  writeFileSync(readmePath, nextReadme);
  console.log(`✅ Regenerated coverage in ${readmePath}.`);
}

await main();
