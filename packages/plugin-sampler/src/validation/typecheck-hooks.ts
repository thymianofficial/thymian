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

    const program = ts.createProgram(
      hookFiles.map((file) => join(paths.hooksDir, file)),
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

  const read = ts.readConfigFile(paths.tsconfigPath, ts.sys.readFile);

  if (read.error) {
    return { options: fallback, diagnostics: [read.error] };
  }

  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    paths.root,
    undefined,
    paths.tsconfigPath,
  );

  return {
    options: { ...fallback, ...parsed.options },
    diagnostics: [...parsed.errors],
  };
}
