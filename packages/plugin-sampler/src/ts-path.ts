/**
 * Normalizes a filesystem path to the forward-slash form TypeScript itself
 * uses for `ts.SourceFile.fileName` and `ts.Diagnostic.file.fileName` —
 * `ts.createProgram` produces that form regardless of platform, while
 * `node:path` (`join`, `relative`, `mkdtemp`) produces the platform's own
 * separator, backslashes on Windows.
 *
 * Printing a path for a user (a tsconfig `exclude` hint, a tree listing) goes
 * through this directly. Comparing a path against a TypeScript file name
 * should go through {@link isSameTsPath} or {@link tsPathRelativeTo} instead —
 * they normalize both sides so a caller cannot compare a raw one against a
 * normalized one by mistake.
 */
export function toTypeScriptPath(path: string): string {
  return path.split(/[\\/]/).join('/');
}

/**
 * Whether two paths — a TypeScript file name and/or a `node:path` value —
 * name the same file, ignoring separator style.
 *
 * A raw `===` holds on POSIX, where the two forms are already the same
 * string, and silently never matches on Windows.
 */
export function isSameTsPath(a: string, b: string): boolean {
  return toTypeScriptPath(a) === toTypeScriptPath(b);
}

/**
 * `fileName`'s path relative to `root`, both normalized first — or
 * `undefined` when `fileName` does not fall under `root`.
 *
 * This is the exclusion test and the display path in one: `validate`'s
 * scratch-surface exclusion asks only whether the result is `undefined`, and
 * the compile probe's diagnostic location uses the string itself. A raw
 * `startsWith`/`slice` pair against un-normalized paths is what let every
 * scratch-surface diagnostic through on Windows — `scratch` is a `node:path`
 * value and `fileName` is TypeScript's own forward-slashed form, so the
 * comparison never matched.
 */
export function tsPathRelativeTo(
  fileName: string,
  root: string,
): string | undefined {
  const path = toTypeScriptPath(fileName);
  const rootPath = toTypeScriptPath(root);

  return path === rootPath || path.startsWith(`${rootPath}/`)
    ? path.slice(rootPath.length + 1)
    : undefined;
}
