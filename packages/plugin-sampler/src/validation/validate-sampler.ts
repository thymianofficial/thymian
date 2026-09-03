import {
  generateTypeSurface,
  type TypeSurface,
} from '../generation/types/generate-type-surface.js';
import {
  readGenerated,
  surfaceAsFiles,
} from '../generation/types/write-type-surface.js';
import type { HookDiagnostic } from '../hooks/hook-diagnostics.js';
import { loadUserHooks } from '../hooks/load-user-hooks.js';
import type { SamplerPaths } from '../sampler-paths.js';
import type { TransactionCatalog } from '../selectors/transaction-catalog.js';
import { sameSurface } from './canonicalize.js';
import { type HookTypeError, typecheckHooks } from './typecheck-hooks.js';

/**
 * How the committed surface stands against the description as it is now.
 *
 * - `absent` — nothing is committed, so there is nothing to be behind. `init`
 *   has not been run, which is a legitimate state.
 * - `in-sync` — canonicalized, the committed files say what a fresh generation
 *   would say.
 * - `behind` — they differ. Whether that matters is the type check's answer,
 *   not this one's.
 */
export type SurfaceState = 'absent' | 'in-sync' | 'behind';

export type ValidationReport = {
  surface: SurfaceState;
  /** Generated files whose canonical form differs, relative to `generated/`. */
  changedFiles: string[];
  /** What `tsc` says about the hooks, against the fresh surface. */
  typeErrors: HookTypeError[];
  /** Hooks whose target resolves to nothing. */
  unresolved: HookDiagnostic[];
  /** Hooks that resolve but cannot both apply. */
  conflicts: HookDiagnostic[];
  /** Hooks created but never exported, so nothing can reach them. */
  unexported: HookDiagnostic[];
  /** Non-fatal things the scan could not do. */
  warnings: string[];
  /**
   * What to tell the user, and what to tell them to do about it.
   *
   * - `ok` — nothing to say.
   * - `stale` — the committed types are behind the description but every hook
   *   still compiles. A **warning**: run `sync`.
   * - `drifted` — the committed types are behind **and** a hook no longer fits.
   *   The description moved: `sync`, then fix the hooks.
   * - `broken` — a hook does not compile, or a target resolves to nothing,
   *   while the committed types are in sync. Nothing has drifted, so `sync` is
   *   *not* the remedy — it would rewrite files that are already correct and
   *   leave the real error in place. Only the hooks need fixing.
   *
   * The last two were one outcome, which meant a plain type error in a hook
   * was announced as "the API description no longer matches these hooks" and
   * answered with a command that could not help.
   */
  outcome: 'ok' | 'stale' | 'drifted' | 'broken';
};

/** Which committed files differ from a fresh generation, canonically. */
export function changedFiles(
  committed: Record<string, string>,
  surface: TypeSurface,
): string[] {
  const fresh = surfaceAsFiles(surface);
  const names = [
    ...new Set([...Object.keys(committed), ...Object.keys(fresh)]),
  ].sort();

  return names.filter((name) => {
    const before = committed[name];
    const after = fresh[name];

    if (before === undefined || after === undefined) {
      return true;
    }

    return !sameSurface(before, after);
  });
}

/**
 * The whole gate: is the committed surface current, and do the hooks still fit
 * the description?
 *
 * The two questions are deliberately separate. "Behind" is about a file the
 * user has to regenerate; "broken" is about a hook the user has to fix. Only
 * the second can fail a build on its own, which is what makes a generator
 * change a warning rather than a wall.
 */
export async function validateSampler(
  paths: SamplerPaths,
  catalog: TransactionCatalog,
): Promise<ValidationReport> {
  const surface = await generateTypeSurface(catalog);
  const committed = await readGenerated(paths);
  const hooks = await loadUserHooks(paths.hooksDir, catalog);
  const typeErrors = await typecheckHooks(paths, surface, hooks.files);

  const state: SurfaceState =
    Object.keys(committed).length === 0
      ? 'absent'
      : changedFiles(committed, surface).length === 0
        ? 'in-sync'
        : 'behind';

  const broken =
    typeErrors.length > 0 ||
    hooks.diagnostics.length > 0 ||
    hooks.conflicts.length > 0 ||
    hooks.unexported.length > 0;

  return {
    surface: state,
    changedFiles: state === 'behind' ? changedFiles(committed, surface) : [],
    typeErrors,
    unresolved: [...hooks.diagnostics],
    conflicts: [...hooks.conflicts],
    unexported: [...hooks.unexported],
    warnings: [...hooks.warnings],
    outcome: broken
      ? state === 'behind'
        ? 'drifted'
        : 'broken'
      : state === 'behind'
        ? 'stale'
        : 'ok',
  };
}
