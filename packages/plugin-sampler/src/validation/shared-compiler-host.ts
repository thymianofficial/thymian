import ts from 'typescript';

/**
 * A parsed-`SourceFile` cache, shared by every `ts.CompilerHost` this module
 * hands out.
 *
 * Keyed by absolute file name only: the files that ever repeat across calls
 * are TypeScript's own `lib.*.d.ts` closure, which lives at a fixed path
 * under `node_modules/typescript` and never changes within a process. A
 * probe's own files live under a fresh `mkdtemp` root every call, so their
 * absolute paths never repeat and this cache never serves stale content for
 * them — it only ever short-circuits a file that is byte-identical to what it
 * already parsed.
 */
const sourceFiles = new Map<string, ts.SourceFile>();

/**
 * A `ts.CompilerHost` that reuses {@link sourceFiles} across every call to
 * `ts.createProgram` a caller makes with it.
 *
 * Each compile-seam program here pins the same `target`/`lib` (ES2023), so
 * `ts.createProgram`'s dominant cost — parsing the lib closure — is identical
 * work performed again on every "cold" program. That cost was paid once per
 * `it()` block across dozens of compile-seam tests, and once per `validate`
 * call in production. A plain `ts.createCompilerHost` has no cross-call cache
 * of its own; this wraps `getSourceFile` with one that does, which is what the
 * review's "share compiler state instead of a cold program per test" asked
 * for — `validate` benefits the same way the tests do, since it goes through
 * the same host.
 */
export function sharedCompilerHost(
  options: ts.CompilerOptions,
): ts.CompilerHost {
  const host = ts.createCompilerHost(options, true);
  const getSourceFile = host.getSourceFile.bind(host);

  host.getSourceFile = (
    fileName,
    languageVersionOrOptions,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (!shouldCreateNewSourceFile) {
      const cached = sourceFiles.get(fileName);

      if (cached) {
        return cached;
      }
    }

    const sourceFile = getSourceFile(
      fileName,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile,
    );

    if (sourceFile) {
      sourceFiles.set(fileName, sourceFile);
    }

    return sourceFile;
  };

  return host;
}
