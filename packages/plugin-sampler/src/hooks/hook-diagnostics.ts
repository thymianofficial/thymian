import { ThymianBaseError } from '@thymian/core';

/** What went wrong with one hook, and where. */
export type HookDiagnostic = {
  /** Hooks-dir-relative path of the file at fault, `/`-normalized. */
  file: string;
  /** The export the registration arrived on, when it is known. */
  exportName?: string;
  /** One sentence, lowercase, completing "…: <reason>". */
  reason: string;
  suggestions?: string[];
};

function describe(diagnostic: HookDiagnostic): string {
  const where = diagnostic.exportName
    ? `${diagnostic.file} (export "${diagnostic.exportName}")`
    : diagnostic.file;

  return `${where}: ${diagnostic.reason}`;
}

/**
 * The run cannot start: at least one hook does not resolve.
 *
 * Every diagnostic is reported, not just the first — one broken hook must not
 * hide the other nine — and each names its own file so the reader knows which
 * line to edit. A dangling selector is never auto-rebound to a "close enough"
 * Transaction, which is the whole point of anchoring a hook to a fully-qualified
 * Selector.
 */
export function unresolvedHooksError(
  diagnostics: readonly HookDiagnostic[],
): ThymianBaseError {
  const count = diagnostics.length;

  return new ThymianBaseError(
    `${count} sampler ${count === 1 ? 'hook does' : 'hooks do'} not resolve against the loaded API description.`,
    {
      name: 'UnresolvedHooksError',
      ref: 'https://thymian.dev/references/errors/unresolved-hooks-error/',
      suggestions: [
        ...diagnostics.map(describe),
        ...diagnostics.flatMap((diagnostic) => diagnostic.suggestions ?? []),
      ],
    },
  );
}

/**
 * Two hooks resolve but cannot both apply.
 *
 * Separate from {@link unresolvedHooksError} because the fault is different: the
 * selector is fine and the file loaded: the pair of hooks is the problem, so the
 * sentence has to say so rather than send the reader looking for a bad selector.
 */
export function hookConflictError(
  conflicts: readonly HookDiagnostic[],
): ThymianBaseError {
  const count = conflicts.length;

  return new ThymianBaseError(
    `${count} sampler ${count === 1 ? 'hook conflicts' : 'hooks conflict'} with another hook on the same transaction.`,
    {
      name: 'HookConflictError',
      ref: 'https://thymian.dev/references/errors/hook-conflict-error/',
      suggestions: [
        ...conflicts.map(describe),
        ...conflicts.flatMap((conflict) => conflict.suggestions ?? []),
      ],
    },
  );
}

/** A hook file could not be imported at all. */
export function hookFileImportError(
  file: string,
  cause: unknown,
): ThymianBaseError {
  return new ThymianBaseError(
    `The hook file "${file}" could not be imported.`,
    {
      name: 'HookFileImportError',
      ref: 'https://thymian.dev/references/errors/hook-file-import-error/',
      cause,
    },
  );
}
