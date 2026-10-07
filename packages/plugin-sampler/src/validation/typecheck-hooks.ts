import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import ts from 'typescript';

import {
  HOOKS_API_FILE,
  REQUEST_TYPES_FILE,
  type TypeSurface,
} from '../generation/types/generate-type-surface.js';
import type { SamplerPaths } from '../sampler-paths.js';
import { toTypeScriptPath, tsPathRelativeTo } from '../ts-path.js';
import { entryExists } from '../utils.js';
import { sharedCompilerHost } from './shared-compiler-host.js';

/**
 * TS18003, "No inputs were found in config file".
 *
 * Raised against the tsconfig's own `include`, which this check never compiles
 * by — the roots are passed to `createProgram` explicitly.
 */
const NO_INPUTS_FOUND = 18003;

/** One `tsc` complaint about a hook, as a reader needs it. */
export type HookTypeError = {
  /** Path of the hook file, relative to the sampler root. */
  file: string;
  /** 1-based line and column. */
  line: number;
  column: number;
  /** `tsc`'s own message, flattened. */
  message: string;
  /** `tsc`'s error code, so a reader can look it up. */
  code: number;
};

/**
 * Type-check the user's hooks against a **freshly generated** surface.
 *
 * The fresh surface, not the committed one: the question `validate` answers is
 * whether the hooks still fit the API description as it is now. Comparing
 * against what is committed would only tell the user whether they had run
 * `sync`, which is the other half of the gate.
 *
 * The surface is written to a temporary directory, so the check never
 * disturbs what is committed — a `validate` that rewrote `generated/` would
 * make `sync --check` pass by having run.
 *
 * The user's own tsconfig supplies the compiler options where it exists,
 * because their hooks are written under those settings. `paths` is *merged*,
 * not replaced: the `@thymian/hooks` alias is added as an **absolute**
 * mapping (to the scratch surface), which TypeScript resolves ahead of
 * `baseUrl` regardless of what the user set it to — see
 * {@link mergeHooksAlias}. A hooks author with their own extra `paths`
 * aliases gets the same resolution their editor gives them; replacing the
 * whole map, as this once did, silently broke every alias the user added.
 */
export async function typecheckHooks(
  paths: SamplerPaths,
  surface: TypeSurface,
  hookFiles: readonly string[],
): Promise<HookTypeError[]> {
  const { options: userOptions, diagnostics: tsconfigDiagnostics } =
    await userCompilerOptions(paths);

  if (hookFiles.length === 0) {
    // Nothing to compile, but a malformed tsconfig is still worth reporting —
    // that is the whole point of not falling back to defaults silently.
    return tsconfigDiagnostics.map((diagnostic) =>
      toHookTypeError(diagnostic, paths.root),
    );
  }

  const scratch = await mkdtemp(join(tmpdir(), 'thymian-validate-'));
  const generated = join(scratch, 'generated');

  try {
    await mkdir(generated, { recursive: true });
    await writeFile(
      join(generated, REQUEST_TYPES_FILE),
      surface.requestTypes,
      'utf-8',
    );
    await writeFile(join(generated, HOOKS_API_FILE), surface.hooksApi, 'utf-8');

    const compilerOptions: ts.CompilerOptions = {
      ...userOptions,
      noEmit: true,
      paths: mergeHooksAlias(
        userOptions.paths,
        join(generated, HOOKS_API_FILE),
      ),
    };

    // TypeScript files only. A `.js`/`.mjs`/`.cjs` hook is legal — the loader
    // runs it, and `transaction-filter.ts` documents that such a file is
    // simply not type-checked — but handed to `createProgram` without
    // `allowJs` it becomes TS6504, a program-level diagnostic with no file of
    // its own, which lands on `tsconfig.json:1:1` and renders `broken`. A hook
    // that runs fine cannot fail the type gate.
    const program = ts.createProgram(
      hookFiles
        .filter((file) => /\.[cm]?ts$/.test(file))
        .map((file) => join(paths.hooksDir, file)),
      compilerOptions,
      sharedCompilerHost(compilerOptions),
    );

    // `scratch` is a `node:path` value (backslashes on Windows);
    // `diagnostic.file.fileName` is TypeScript's own forward-slashed form.
    // `tsPathRelativeTo` normalizes both, so this excludes a scratch-surface
    // diagnostic on every platform — a raw `startsWith` never matched on
    // Windows, and every one of these diagnostics leaked through.
    const diagnostics = [
      ...tsconfigDiagnostics,
      ...ts.getPreEmitDiagnostics(program),
    ].filter(
      (diagnostic) =>
        !diagnostic.file ||
        tsPathRelativeTo(diagnostic.file.fileName, scratch) === undefined,
    );

    return diagnostics.map((diagnostic) =>
      toHookTypeError(diagnostic, paths.root),
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

/**
 * One `ts.Diagnostic`, in the shape `validate`'s callers read.
 *
 * A diagnostic with no `file` is about the *options* rather than a source
 * file — a malformed tsconfig, an unresolvable `types` entry — and is
 * attributed to `tsconfig.json` rather than dropped. Dropping these is what
 * made a broken tsconfig fail silently and report a clean bill of health.
 */
function toHookTypeError(
  diagnostic: ts.Diagnostic,
  root: string,
): HookTypeError {
  const file = diagnostic.file;

  if (!file) {
    return {
      file: 'tsconfig.json',
      line: 1,
      column: 1,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
      code: diagnostic.code,
    };
  }

  const { line, character } = file.getLineAndCharacterOfPosition(
    diagnostic.start ?? 0,
  );

  return {
    file: relative(root, file.fileName),
    line: line + 1,
    column: character + 1,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    code: diagnostic.code,
  };
}

/**
 * The user's own `paths`, plus `@thymian/hooks` pointed at the fresh surface
 * as an absolute mapping.
 *
 * TypeScript resolves a rooted (absolute) `paths` entry ahead of `baseUrl` —
 * `combinePaths` returns the rooted candidate outright — so this alias
 * resolves to the scratch surface no matter what the user's `baseUrl` is, or
 * whether they set one at all. That is what lets the rest of the user's
 * `paths` keep resolving under *their* `baseUrl`, unreplaced.
 */
function mergeHooksAlias(
  userPaths: ts.MapLike<string[]> | undefined,
  hooksApiFile: string,
): ts.MapLike<string[]> {
  return {
    ...userPaths,
    '@thymian/hooks': [toTypeScriptPath(hooksApiFile)],
  };
}

/**
 * The compiler options the user's own sampler tsconfig sets, or the defaults
 * `init` would have scaffolded — plus whatever the tsconfig itself failed to
 * read or parse, as diagnostics rather than a swallowed error.
 *
 * A tsconfig the user has edited is the whole reason `init` writes it once, so
 * `validate` has to honour it — including a `strict: false` a user chose. A
 * tsconfig that fails outright still yields the fallback options, so a typo
 * elsewhere in the hooks is not masked by an unrelated config error — but the
 * config error itself is never dropped.
 */
async function userCompilerOptions(paths: SamplerPaths): Promise<{
  options: ts.CompilerOptions;
  diagnostics: ts.Diagnostic[];
}> {
  const fallback: ts.CompilerOptions = {
    strict: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2023,
    skipLibCheck: true,
  };

  if (!(await entryExists(paths.tsconfigPath))) {
    return { options: fallback, diagnostics: [] };
  }

  // Normalized before it reaches TypeScript, which compares the name it is
  // given against the forward-slashed one it derives for the diagnostic's
  // source file. Handed a `node:path` value, that comparison is an internal
  // assertion failure on Windows — and only when a diagnostic exists at all,
  // so a malformed tsconfig crashed where a valid one was fine.
  const tsconfigPath = toTypeScriptPath(paths.tsconfigPath);
  const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (read.error) {
    return { options: fallback, diagnostics: [read.error] };
  }

  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    toTypeScriptPath(paths.root),
    undefined,
    tsconfigPath,
  );

  return {
    options: { ...fallback, ...parsed.options },
    // TS18003 ("No inputs were found in config file") is not a fault of the
    // user's tsconfig: the scaffolded `include` names `hooks/**/*.ts` and
    // `generated/**/*.d.ts`, and a sampler directory with neither yet is the
    // ordinary state right after `sampler init`. Reported, it renders the
    // whole surface `broken` at `tsconfig.json:1:1` over an empty hooks tree.
    // What actually compiles is decided by the root files passed to
    // `createProgram` below, never by this `include`.
    diagnostics: parsed.errors.filter(
      (diagnostic) => diagnostic.code !== NO_INPUTS_FOUND,
    ),
  };
}
