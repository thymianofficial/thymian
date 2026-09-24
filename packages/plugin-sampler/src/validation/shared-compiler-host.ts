import ts from 'typescript';

/**
 * A parsed-`SourceFile` cache, shared by every `ts.CompilerHost` this module
 * hands out.
 *
 * **Only TypeScript's own `lib.*.d.ts` closure.** That closure is the whole
 * win — it is the dominant cost of a cold `ts.createProgram`, every program
 * here pins the same `target`/`lib`, and it lives at a fixed path under
 * `node_modules/typescript` that cannot change within a process.
 *
 * Nothing else may be cached, because a file name is not a version. The
 * probes write under a fresh `mkdtemp` root per call, so caching them only
 * grows the map forever; the user's hooks are worse — `typecheck-hooks.ts`
 * compiles them at their *stable* paths, and `sampler.validate` is an ordinary
 * action that `thymian serve` dispatches over the WebSocket proxy. In one
 * long-lived `serve` process the second `validate` after an edit would have
 * type-checked the first call's parse: a fixed hook still reporting its old
 * error, a newly broken one passing. One-shot CLI runs never showed it.
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
  const libDirectory = host.getDefaultLibLocation?.();

  /** Immutable for the life of the process, so safe to hold parsed. */
  const isLibFile = (fileName: string): boolean =>
    libDirectory !== undefined &&
    fileName.startsWith(
      libDirectory.endsWith('/') ? libDirectory : `${libDirectory}/`,
    );

  host.getSourceFile = (
    fileName,
    languageVersionOrOptions,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const cacheable = isLibFile(fileName);

    if (cacheable && !shouldCreateNewSourceFile) {
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

    if (sourceFile && cacheable) {
      sourceFiles.set(fileName, sourceFile);
    }

    return sourceFile;
  };

  return host;
}
