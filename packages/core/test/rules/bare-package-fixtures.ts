import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Builds a throwaway `node_modules` tree in a temp dir so the bare-specifier
// resolver can be exercised against real, installed-package shapes without
// committing a `node_modules/` directory into the repo (a committed fixture
// node_modules trips prettier/lint-staged, which ignores `node_modules`). Each
// caller gets its own temp project via `beforeAll`/`afterAll`.
//
// A minimal, self-contained rule so a loaded fixture passes rule validation
// (`informational` needs no execution function).
const RULE_MODULE = (name: string) =>
  `export default { meta: { name: ${JSON.stringify(name)}, severity: 'error', type: ['informational'], tags: [], options: {} } };\n`;

export interface BarePackageFixtures {
  /** Absolute, realpath-canonical project dir to pass as `cwd`. */
  readonly projectDir: string;
  /** Absolute path of an installed package's file, for path assertions. */
  packageFile(pkg: string, file: string): string;
  cleanup(): void;
}

export function makeBarePackageFixtures(): BarePackageFixtures {
  // Canonicalise with `realpathSync.native` — the same call the seam uses — so
  // fixture paths match what `resolveUserModule` returns. On Windows the two
  // forms differ: `.native` expands the 8.3 short name (e.g. `RUNNER~1`) to the
  // long form (`runneradmin`) that the resolver reports.
  const projectDir = realpathSync.native(
    mkdtempSync(join(tmpdir(), 'thymian-bare-')),
  );
  const nodeModules = join(projectDir, 'node_modules');

  const write = (relativePath: string, content: string): void => {
    const filePath = join(nodeModules, relativePath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  };

  // Ships unbuilt TypeScript source (main → .ts): must be declined (AC2).
  write(
    'unbuilt-ts-pkg/package.json',
    JSON.stringify({
      name: 'unbuilt-ts-pkg',
      version: '1.0.0',
      type: 'module',
      main: './index.ts',
    }),
  );
  write('unbuilt-ts-pkg/index.ts', RULE_MODULE('unbuilt'));

  // Restricts `exports` and does NOT expose `./package.json` — a common,
  // loadable shape that must resolve, not be declined as "broken".
  write(
    'restricted-exports-pkg/package.json',
    JSON.stringify({
      name: 'restricted-exports-pkg',
      version: '1.0.0',
      type: 'module',
      exports: { '.': './index.js' },
    }),
  );
  write(
    'restricted-exports-pkg/index.js',
    RULE_MODULE('restricted-exports-rule'),
  );

  // Array-form `exports` fallbacks + a decoy `main`: the exports target wins.
  write(
    'array-exports-pkg/package.json',
    JSON.stringify({
      name: 'array-exports-pkg',
      version: '1.0.0',
      type: 'module',
      exports: ['./correct.js'],
      main: './wrong.js',
    }),
  );
  write('array-exports-pkg/correct.js', RULE_MODULE('array-exports-correct'));
  write('array-exports-pkg/wrong.js', RULE_MODULE('array-exports-WRONG'));

  // Installed but broken: package.json is not valid JSON.
  write('broken-pkg/package.json', '{ this is not valid JSON\n');

  return {
    projectDir,
    packageFile: (pkg, file) => join(nodeModules, pkg, file),
    cleanup: () => rmSync(projectDir, { recursive: true, force: true }),
  };
}
