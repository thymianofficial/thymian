import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import type { SamplerPaths } from '../../sampler-paths.js';
import { toTypeScriptPath } from '../../ts-path.js';
import { entryExists } from '../../utils.js';
import {
  HOOKS_API_FILE,
  REQUEST_TYPES_FILE,
  type TypeSurface,
} from './generate-type-surface.js';

/**
 * The tsconfig `init` scaffolds, once.
 *
 * It is **user-owned from then on**: `sync` never rewrites it, because a user's
 * edits here — a `types` entry, a stricter flag, an extra `include` — are
 * legitimate and losing them silently would be worse than any convenience of
 * keeping it current. A future plugin version needing a different tsconfig is a
 * documented manual step, not an overwrite.
 *
 * The `paths` alias is what makes `@thymian/hooks` resolve in an editor. It is
 * not what makes hooks *run*: the runtime resolves through a jiti alias, so a
 * project with no tsconfig at all still executes its hooks.
 *
 * No `types` entry, deliberately. The generated surface needs no `@types/node`
 * — `readFile` answers a `Uint8Array` and the encodings are spelled out — so a
 * project without it still type-checks. A hook file that imports `node:fs`
 * needs it and adds it here, which is a legitimate edit and the reason this
 * file is scaffolded once rather than regenerated.
 */
export function scaffoldTsconfig(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        baseUrl: '.',
        module: 'nodenext',
        moduleResolution: 'nodenext',
        target: 'es2023',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        paths: {
          '@thymian/hooks': [`./generated/${HOOKS_API_FILE}`],
        },
      },
      include: ['./hooks/**/*.ts', './generated/**/*.d.ts'],
    },
    null,
    2,
  )}\n`;
}

/**
 * The note `init` prints about the repository's own tsconfig.
 *
 * The root tsconfig is never modified — it is the project's, not the sampler's —
 * so the one thing a user has to do by hand is say so.
 */
export function rootExcludeNote(paths: SamplerPaths, cwd: string): string[] {
  // A tsconfig `exclude` entry is a glob TypeScript matches against its own
  // forward-slashed file names, so the hint has to be printed in that form on
  // every platform — a Windows `\` here is a suggestion the user's own
  // tsconfig would silently fail to honour.
  const rootRelative = toTypeScriptPath(
    relative(cwd, paths.root) || paths.root,
  );

  return [
    `Add ${JSON.stringify(rootRelative)} to the "exclude" list of your project's own tsconfig.json.`,
    'Without it your project compiles the hooks with its own settings, and the sampler tsconfig — the one that knows where `@thymian/hooks` lives — never governs them.',
  ];
}

/**
 * Write the generated directory, wholesale.
 *
 * Wipe and rewrite rather than merge: a file left over from a description that
 * no longer has that shape is exactly the stale artifact the virtual model
 * exists to remove, and a merge cannot tell one from a file a user added.
 * Everything outside `generated/` — the hooks, the tsconfig — is untouched.
 */
export async function writeGenerated(
  paths: SamplerPaths,
  surface: TypeSurface,
): Promise<string[]> {
  const before = await readGenerated(paths);
  const fresh = surfaceAsFiles(surface);

  await rm(paths.generatedDir, { recursive: true, force: true });
  await mkdir(paths.generatedDir, { recursive: true });

  for (const [name, contents] of Object.entries(fresh)) {
    await writeFile(join(paths.generatedDir, name), contents, 'utf-8');
  }

  // Which files' *bytes* moved, which is not the same question as which types
  // moved: the drift gate compares canonicalized, so a description edit is not
  // drift — but it does change the file, and a user told "these match" while
  // finding a diff in their working tree is owed the difference.
  return [...new Set([...Object.keys(before), ...Object.keys(fresh)])]
    .filter((name) => before[name] !== fresh[name])
    .sort();
}

/**
 * What is currently committed under `generated/`, file name → contents.
 *
 * Reads only the files the surface itself ever writes — {@link
 * REQUEST_TYPES_FILE} and {@link HOOKS_API_FILE} — rather than every
 * directory entry. `writeGenerated` wipes and rewrites the whole directory on
 * every write, so anything else in it was never put there by the sampler: a
 * macOS `.DS_Store`, an editor swap file, a stray subdirectory. `readdir`
 * would hand all of it back with no way to tell a file from a directory
 * without a second syscall per entry, and blindly `readFile`-ing a
 * subdirectory throws `EISDIR` — crashing `sync --check`, `validate` and
 * `thymian test` alike, mid-command, on a file the user never asked the
 * sampler to look at. Naming the two files instead of listing the directory
 * sidesteps both failure modes: a stray entry is neither read nor compared,
 * so it is silently ignored rather than reported as spurious drift.
 */
export async function readGenerated(
  paths: SamplerPaths,
): Promise<Record<string, string>> {
  if (!(await entryExists(paths.generatedDir))) {
    return {};
  }

  const files: Record<string, string> = {};

  for (const name of [HOOKS_API_FILE, REQUEST_TYPES_FILE].sort()) {
    const path = join(paths.generatedDir, name);

    if (await entryExists(path)) {
      files[name] = await readFile(path, 'utf-8');
    }
  }

  return files;
}

/** The surface as the file map it is written as, for comparison without I/O. */
export function surfaceAsFiles(surface: TypeSurface): Record<string, string> {
  return {
    [HOOKS_API_FILE]: surface.hooksApi,
    [REQUEST_TYPES_FILE]: surface.requestTypes,
  };
}
