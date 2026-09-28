import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ThymianBaseError } from '@thymian/core';
import ts from 'typescript';

import { tsPathRelativeTo } from '../../ts-path.js';
import { sharedCompilerHost } from '../../validation/shared-compiler-host.js';
import {
  HOOKS_API_FILE,
  REQUEST_TYPES_FILE,
  type TypeSurface,
} from './generate-type-surface.js';

/**
 * Compile the emitted declaration files **alone**, with `skipLibCheck: false`,
 * and report what `tsc` says about them.
 *
 * Every path that consumes the surface afterwards — the scaffolded tsconfig,
 * `typecheckHooks`, the hook-authoring compile probe — sets `skipLibCheck:
 * true`, because a user's own `@types` tree is not the sampler's business to
 * police. That is exactly the flag that stops TypeScript from reporting an
 * error *inside* a `.d.ts`, so the file the sampler commits — and whose diff
 * is the drift signal every other gate trusts — is the one file none of those
 * paths actually check. This is the check that does.
 *
 * Both files are given as program roots, not just one: `hooksApi` imports
 * `requestTypes`, so a root of `requestTypes` alone never pulls `hooksApi`
 * into the program, and a defect confined to the (mostly static) hooks
 * surface would go unreported.
 */
export async function surfaceDiagnostics(
  surface: TypeSurface,
): Promise<string[]> {
  const root = await mkdtemp(join(tmpdir(), 'thymian-surface-check-'));

  try {
    const generated = join(root, 'generated');
    const requestTypes = join(generated, REQUEST_TYPES_FILE);
    const hooksApi = join(generated, HOOKS_API_FILE);

    await mkdir(generated, { recursive: true });
    await writeFile(requestTypes, surface.requestTypes, 'utf-8');
    await writeFile(hooksApi, surface.hooksApi, 'utf-8');

    const options: ts.CompilerOptions = {
      strict: true,
      noEmit: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2023,
      // The whole point of this probe: do not skip the files under test.
      skipLibCheck: false,
      baseUrl: root,
      paths: { '@thymian/hooks': [`./generated/${HOOKS_API_FILE}`] },
      lib: ['lib.es2023.d.ts'],
      types: [],
    };

    const program = ts.createProgram(
      [hooksApi, requestTypes],
      options,
      sharedCompilerHost(options),
    );

    return ts.getPreEmitDiagnostics(program).flatMap((diagnostic) => {
      const file = diagnostic.file;
      // `generated` is a `node:path` value; TypeScript's own `fileName`s are
      // forward-slashed. `tsPathRelativeTo` normalizes both, which keeps this
      // correct on Windows.
      const relativeFile = file
        ? tsPathRelativeTo(file.fileName, generated)
        : undefined;

      if (!file || relativeFile === undefined) {
        return [];
      }

      const { line } = file.getLineAndCharacterOfPosition(
        diagnostic.start ?? 0,
      );
      const where = `${relativeFile}:${line + 1}`;
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        ' ',
      );

      return [`${where} TS${diagnostic.code}: ${message}`];
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/**
 * The self-check gate: refuse to hand back a surface that does not compile.
 *
 * Called wherever a fresh surface is produced — `init`, `sync`, and
 * `validate`'s scratch surface — so no emitter defect, present or future, can
 * hide behind a user's own compiler settings (`skipLibCheck` among them) and
 * surface later as a confusing error in their hooks. The message and the
 * `GeneratedSurfaceError` name deliberately attribute the fault to the
 * generator: whatever a diagnostic here says, it is never something a user's
 * API description or hooks could have caused.
 */
export async function selfCheckSurface(surface: TypeSurface): Promise<void> {
  const diagnostics = await surfaceDiagnostics(surface);

  if (diagnostics.length === 0) {
    return;
  }

  throw new ThymianBaseError(
    `The sampler generated a type surface that does not compile (${diagnostics.length} ${
      diagnostics.length === 1 ? 'diagnostic' : 'diagnostics'
    }). This is a defect in the sampler's own generator — not your API description or your hooks — please report it.`,
    {
      name: 'GeneratedSurfaceError',
      ref: 'https://thymian.dev/references/errors/generated-surface-error/',
      suggestions: diagnostics,
    },
  );
}
