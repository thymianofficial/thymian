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
import { entryExists } from '../utils.js';

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
 * The surface is written to a temporary directory and aliased there, so the
 * check never disturbs what is committed — a `validate` that rewrote
 * `generated/` would make `sync --check` pass by having run.
 *
 * The user's own tsconfig supplies the compiler options where it exists,
 * because their hooks are written under those settings; only `paths` is
 * overridden, to point at the fresh surface.
 */
export async function typecheckHooks(
  paths: SamplerPaths,
  surface: TypeSurface,
  hookFiles: readonly string[],
): Promise<HookTypeError[]> {
  if (hookFiles.length === 0) {
    return [];
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

    const program = ts.createProgram(
      hookFiles.map((file) => join(paths.hooksDir, file)),
      {
        ...(await userCompilerOptions(paths)),
        noEmit: true,
        baseUrl: scratch,
        paths: { '@thymian/hooks': [`./generated/${HOOKS_API_FILE}`] },
      },
    );

    return ts
      .getPreEmitDiagnostics(program)
      .filter((diagnostic) => !diagnostic.file?.fileName.startsWith(scratch))
      .map((diagnostic) => {
        const file = diagnostic.file;

        if (!file) {
          // A diagnostic about the *options* rather than a file — a malformed
          // tsconfig, an unresolvable `types` entry. Dropping these made a
          // broken tsconfig fail silently and report a clean bill of health.
          return {
            file: 'tsconfig.json',
            line: 1,
            column: 1,
            message: ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              ' ',
            ),
            code: diagnostic.code,
          };
        }

        const { line, character } = file.getLineAndCharacterOfPosition(
          diagnostic.start ?? 0,
        );

        return {
          file: relative(paths.root, file.fileName),
          line: line + 1,
          column: character + 1,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
          code: diagnostic.code,
        };
      });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

/**
 * The compiler options the user's own sampler tsconfig sets, or the defaults
 * `init` would have scaffolded.
 *
 * A tsconfig the user has edited is the whole reason `init` writes it once, so
 * `validate` has to honour it — including a `strict: false` a user chose.
 */
async function userCompilerOptions(
  paths: SamplerPaths,
): Promise<ts.CompilerOptions> {
  const fallback: ts.CompilerOptions = {
    strict: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2023,
    skipLibCheck: true,
  };

  if (!(await entryExists(paths.tsconfigPath))) {
    return fallback;
  }

  const read = ts.readConfigFile(paths.tsconfigPath, ts.sys.readFile);

  if (read.error) {
    return fallback;
  }

  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, paths.root);

  return { ...fallback, ...parsed.options };
}
