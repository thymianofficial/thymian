import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { sharedCompilerHost } from '../src/validation/shared-compiler-host.js';

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2023,
  lib: ['lib.es2023.d.ts'],
  noEmit: true,
  types: [],
};

describe('sharedCompilerHost', () => {
  it('reuses the same parsed lib SourceFile across two programs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'thymian-host-test-'));
    const fileA = join(root, 'a.ts');
    const fileB = join(root, 'b.ts');

    await writeFile(fileA, 'export const a = 1;\n', 'utf-8');
    await writeFile(fileB, 'export const b = 2;\n', 'utf-8');

    const hostA = sharedCompilerHost(OPTIONS);
    const programA = ts.createProgram([fileA], OPTIONS, hostA);
    const libFileName = programA
      .getSourceFiles()
      .find((f) => f.fileName.endsWith('lib.es2023.d.ts'))?.fileName;

    if (!libFileName) {
      throw new Error('expected the program to include the pinned lib file');
    }

    const libSourceFileA = hostA.getSourceFile(
      libFileName,
      ts.ScriptTarget.ES2023,
    );

    const hostB = sharedCompilerHost(OPTIONS);
    ts.createProgram([fileB], OPTIONS, hostB);
    const libSourceFileB = hostB.getSourceFile(
      libFileName,
      ts.ScriptTarget.ES2023,
    );

    // Two independent hosts, built for two unrelated programs — the cache is
    // module-level, so the second host serves the identical parsed object
    // rather than re-parsing the lib file from disk.
    expect(libSourceFileB).toBe(libSourceFileA);
  });

  it('still parses each probe file fresh, keyed by its own path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'thymian-host-test-'));
    const file = join(root, 'probe.ts');

    await writeFile(file, 'export const one = 1;\n', 'utf-8');

    const host = sharedCompilerHost(OPTIONS);
    const program = ts.createProgram([file], OPTIONS, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(diagnostics).toEqual([]);
    expect(program.getSourceFile(file)?.text).toContain('export const one');
  });
});
