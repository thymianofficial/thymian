import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ts from 'typescript';

import { generateTypeSurface } from '../src/generation/types/generate-type-surface.js';
import {
  HOOKS_API_FILE,
  REQUEST_TYPES_FILE,
} from '../src/generation/types/generate-type-surface.js';
import { surfaceDiagnostics } from '../src/generation/types/self-check-surface.js';
import type { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { isSameTsPath } from '../src/ts-path.js';
import { sharedCompilerHost } from '../src/validation/shared-compiler-host.js';

export type Diagnostic = {
  /** 1-based line within the probe file. */
  line: number;
  /** The text of that line, trimmed. */
  code: string;
  message: string;
};

/**
 * Compile a hook file against a freshly generated type surface and report the
 * diagnostics, each anchored to the probe's own line.
 *
 * This is the **generated-surface compile seam**: the thing under test is what
 * `tsc` says about code a user would write, so the assertions are diagnostics
 * and their lines — not the emitted text. Text assertions are what let the
 * earlier attempt's object-union reflection ship: every string matched, and
 * ordinary mutation was still a compile error.
 */
export async function compileHook(
  catalog: TransactionCatalog,
  source: string,
): Promise<Diagnostic[]> {
  const root = await mkdtemp(join(tmpdir(), 'thymian-probe-'));
  const generated = join(root, 'generated');
  const surface = await generateTypeSurface(catalog);

  await mkdir(generated, { recursive: true });
  await writeFile(
    join(generated, REQUEST_TYPES_FILE),
    surface.requestTypes,
    'utf-8',
  );
  await writeFile(join(generated, HOOKS_API_FILE), surface.hooksApi, 'utf-8');

  const probe = join(root, 'probe.ts');
  await writeFile(probe, source, 'utf-8');

  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2023,
    skipLibCheck: true,
    baseUrl: root,
    paths: { '@thymian/hooks': [`./generated/${HOOKS_API_FILE}`] },
    // The probe imports nothing from node, and pinning the lib keeps the
    // diagnostics about the surface rather than about the environment.
    lib: ['lib.es2023.d.ts'],
    types: [],
  };

  const program = ts.createProgram(
    [probe],
    options,
    sharedCompilerHost(options),
  );

  const lines = source.split('\n');

  return ts
    .getPreEmitDiagnostics(program)
    .filter(
      (diagnostic) =>
        diagnostic.file && isSameTsPath(diagnostic.file.fileName, probe),
    )
    .map((diagnostic) => {
      const { line } = diagnostic.file!.getLineAndCharacterOfPosition(
        diagnostic.start ?? 0,
      );

      return {
        line: line + 1,
        code: (lines[line] ?? '').trim(),
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
      };
    });
}

/**
 * Compile the generated surface **on its own**, and report what `tsc` says
 * about it.
 *
 * A thin wrapper over {@link surfaceDiagnostics} — the production self-check
 * gate that `init`, `sync` and `validate` all run before handing back a fresh
 * surface. Routing the test seam through the same function means a test here
 * asserts the property production actually enforces, not a parallel
 * implementation of it.
 */
export async function checkSurface(
  catalog: TransactionCatalog,
): Promise<string[]> {
  return surfaceDiagnostics(await generateTypeSurface(catalog));
}
