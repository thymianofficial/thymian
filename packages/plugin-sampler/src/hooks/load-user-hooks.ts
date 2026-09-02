import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJiti } from 'jiti';

import { parseSelector, type Selector } from '../selectors/selector.js';
import type { TransactionCatalog } from '../selectors/transaction-catalog.js';
import { entryExists } from '../utils.js';
import type { HookDiagnostic } from './hook-diagnostics.js';
import { hookFileImportError } from './hook-diagnostics.js';
import {
  type HookRegistration,
  isHookRegistration,
} from './hook-registration.js';

/**
 * `@thymian/hooks` is resolved by **this** alias — not by a tsconfig `paths`
 * entry and not by a committed `.d.ts` — which is what lets a hook file import
 * runtime values in a workspace with no generated directory, no generated
 * tsconfig and `sampler init` never run.
 *
 * Two properties are load-bearing:
 *
 * - **An absolute path, never a bare specifier.** The package exports only `"."`
 *   and `"./package.json"`, so `'@thymian/plugin-sampler/hook-api'` would be
 *   blocked by the exports map in a published install, and adding a subpath
 *   export would put an internal module on the public surface. Deriving the path
 *   from `import.meta.url` sidesteps the exports map entirely.
 * - **Extensionless.** jiti resolves `.js .mjs .cjs .ts .mts .cts` itself, so one
 *   target serves `dist/hooks/hook-api.js` in an installed CLI and
 *   `src/hooks/hook-api.ts` when running from source, identically.
 */
const hooksRuntimeModule = fileURLToPath(
  new URL('./hook-api.js', import.meta.url),
).replace(/\.[cm]?js$/, '');

/** The specifier a hook file writes. */
export const HOOKS_RUNTIME_SPECIFIER = '@thymian/hooks';

/**
 * Keep a file iff its name ends in one of the six module extensions and is not a
 * declaration file.
 *
 * `.tsx`/`.jsx` are not among them: JSX needs a transform pragma this jiti
 * instance is not configured for, so such a file would be scanned only to fail
 * on its own syntax.
 *
 * The declaration-file exclusion is case-insensitive while the keep pattern is
 * not. `types.D.ts` ends in `.ts` and so matched the keep pattern, but missed a
 * case-sensitive `\.d\.ts$` — and a hand-written declaration file handed to jiti
 * fails on its own `declare module` syntax. Widening the exclusion can only ever
 * skip a file that could not have executed; widening the keep pattern the same
 * way would make the scan depend on filesystem case sensitivity.
 */
export function isHookFile(name: string): boolean {
  if (/\.d\.[cm]?ts$/i.test(name)) {
    return false;
  }

  return /\.[cm]?[jt]s$/.test(name);
}

/** The hooks that apply to one Transaction, each in registration order. */
export type TransactionHooks = {
  readonly defineSample: readonly CollectedRegistration[];
  readonly beforeEach: readonly CollectedRegistration[];
  readonly afterEach: readonly CollectedRegistration[];
  readonly authorize: readonly CollectedRegistration[];
};

/** The mutable form the loader fills in before handing it out. */
type MutableTransactionHooks = {
  -readonly [K in keyof TransactionHooks]: CollectedRegistration[];
};

/** A registration plus where it came from, which only the loader knows. */
export type CollectedRegistration = {
  registration: HookRegistration;
  /** Hooks-dir-relative path, `/`-normalized. */
  file: string;
  exportName: string;
  /**
   * Position in the whole scan: file order on the outside, registration order
   * inside each file.
   *
   * The registration's own `order` cannot serve: the hooks runtime is
   * re-evaluated per file, so its counter restarts. This is the one number that
   * orders every hook in the run against every other, which is what run-scoped
   * teardown needs to reverse.
   */
  sequence: number;
};

export type LoadUserHooksResult = {
  /** Hook files found, in load order. */
  files: readonly string[];
  /** Per-transaction bindings, keyed by transaction id. */
  byTransactionId: ReadonlyMap<string, TransactionHooks>;
  /** Run-scoped registrations, in registration order. */
  runScoped: {
    beforeAll: CollectedRegistration[];
    afterAll: CollectedRegistration[];
  };
  /** The global `authorize(callback)` registrations, in registration order. */
  globalAuthorize: CollectedRegistration[];
  /** Every hook that does not resolve. A non-empty list must fail the run. */
  diagnostics: readonly HookDiagnostic[];
  /**
   * Hooks that resolve but cannot both apply — today, two `defineSample` hooks
   * on one Transaction. Kept apart from {@link diagnostics} because the fault is
   * different and so is the sentence a reader needs: the selector is fine, the
   * pair of hooks is not.
   */
  conflicts: readonly HookDiagnostic[];
  /**
   * Things the scan could not do, which are not a hook failing to resolve.
   *
   * Kept apart from {@link diagnostics} on purpose: an unreadable subdirectory
   * is why the walk goes a level at a time, and turning it into a fatal error
   * would throw away every healthy hook in the tree — the outcome the level-wise
   * walk exists to avoid. These are reported as warnings and the run continues.
   */
  warnings: readonly string[];
};

/** Hooks-dir-relative, `/`-normalized — the sort key and the diagnostic label. */
function hooksDirRelative(hooksDir: string, full: string): string {
  return relative(hooksDir, full).split(/[\\/]/).join('/');
}

/**
 * One directory level, then its subdirectories.
 *
 * Deliberately not `readdir({ recursive: true })`: that is a single call, so an
 * `EACCES` on any nested directory rejects the *whole* walk and loses every
 * healthy hook in the tree. Walking a level at a time costs one `readdir` per
 * directory and confines a failure to the subtree that actually failed.
 *
 * Dot-directories are skipped, so an editor's or a tool's cache inside the hooks
 * tree is not scanned.
 */
async function walkHookDirectory(
  hooksDir: string,
  dir: string,
  isRoot: boolean,
  files: string[],
  warnings: string[],
): Promise<void> {
  let entries: Dirent[];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isRoot) {
      throw error;
    }

    warnings.push(
      `The hooks subdirectory "${hooksDirRelative(hooksDir, dir)}" could not be read (${error instanceof Error ? error.message : String(error)}), so any hooks inside it were not loaded.`,
    );

    return;
  }

  const directories: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.')) {
        directories.push(full);
      }

      continue;
    }

    if (entry.isFile() && isHookFile(entry.name)) {
      files.push(full);
    }
  }

  for (const directory of directories) {
    await walkHookDirectory(hooksDir, directory, false, files, warnings);
  }
}

/**
 * A stable load order: hooks-dir-relative key, by code unit.
 *
 * `readdir` order is filesystem-dependent, and composition order is observable,
 * so the order hooks are loaded in is a decision rather than an accident.
 */
function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Every registration exported by one module namespace, with its export name.
 *
 * Both a registration and an array of them count, at any export name including
 * `default`. Nothing here calls a value to find out what it is: functions are
 * rejected structurally by {@link isHookRegistration}.
 */
function collectFromNamespace(
  namespace: unknown,
  file: string,
): CollectedRegistration[] {
  if (typeof namespace !== 'object' || namespace === null) {
    return [];
  }

  const collected: CollectedRegistration[] = [];

  for (const exportName of Object.keys(namespace)) {
    let value: unknown;

    try {
      value = (namespace as Record<string, unknown>)[exportName];
    } catch {
      // A getter that throws is not a hook; the module's other exports stand.
      continue;
    }

    if (isHookRegistration(value)) {
      collected.push({ registration: value, file, exportName, sequence: 0 });

      continue;
    }

    if (Array.isArray(value)) {
      for (const element of value) {
        if (isHookRegistration(element)) {
          collected.push({
            registration: element,
            file,
            exportName,
            sequence: 0,
          });
        }
      }
    }
  }

  return collected;
}

function emptyTransactionHooks(): MutableTransactionHooks {
  return {
    defineSample: [],
    beforeEach: [],
    afterEach: [],
    authorize: [],
  };
}

/**
 * The selectors a target names, or `undefined` when it is not a selector form.
 *
 * Takes `unknown` rather than `HookTarget`: a `.js` hook file is legal input and
 * is not type-checked, so the value here is whatever the user passed.
 */
function selectorsOf(target: unknown): readonly Selector[] | undefined {
  if (typeof target === 'string') {
    return [target];
  }

  if (Array.isArray(target) && target.every((v) => typeof v === 'string')) {
    return target as readonly Selector[];
  }

  return undefined;
}

/**
 * Scan the hooks directory and bind every registration it exports to the
 * Transactions it names.
 *
 * A hooks directory that does not exist is not an error — `sampler init` is
 * optional and a project may have no hooks at all — it is an empty result.
 */
export async function loadUserHooks(
  hooksDir: string,
  catalog: TransactionCatalog,
): Promise<LoadUserHooksResult> {
  const diagnostics: HookDiagnostic[] = [];
  const conflicts: HookDiagnostic[] = [];
  const warnings: string[] = [];
  const byTransactionId = new Map<string, MutableTransactionHooks>();
  const runScoped = {
    beforeAll: [] as CollectedRegistration[],
    afterAll: [] as CollectedRegistration[],
  };
  const globalAuthorize: CollectedRegistration[] = [];

  if (!(await entryExists(hooksDir))) {
    return {
      files: [],
      byTransactionId,
      runScoped,
      globalAuthorize,
      diagnostics,
      conflicts,
      warnings,
    };
  }

  const found: string[] = [];
  await walkHookDirectory(hooksDir, hooksDir, true, found, warnings);

  const files = found
    .map((full) => ({ full, key: hooksDirRelative(hooksDir, full) }))
    .sort((a, b) => compareKeys(a.key, b.key));

  const jiti = createJiti(hooksRuntimeModule, {
    alias: { [HOOKS_RUNTIME_SPECIFIER]: hooksRuntimeModule },
    // A hook file is user code that may have been edited between runs, and a
    // run is short-lived: nothing is gained by caching its transpilation, and a
    // stale entry would be served silently.
    fsCache: false,
    moduleCache: false,
  });

  const collected: CollectedRegistration[] = [];

  for (const { full, key } of files) {
    let namespace: unknown;

    try {
      namespace = await jiti.import(full);
    } catch (error) {
      throw hookFileImportError(key, error);
    }

    // Registration order **within the file**, not export order: an ESM
    // namespace exposes its keys sorted, so `order` is the only thing that
    // knows which hook the file created first.
    //
    // Sorting per file rather than once at the end is what makes the order
    // whole. `order` is stamped by the hooks runtime, and that runtime is
    // re-evaluated per file because the module cache is off — so the counter
    // restarts, and a global sort by `order` interleaved the files. File order
    // is the outer key and it is already deterministic; `order` only has to
    // sequence what one file registered.
    collected.push(
      ...collectFromNamespace(namespace, key).sort(
        (a, b) => a.registration.order - b.registration.order,
      ),
    );
  }

  // One number ordering every hook in the run against every other. Assigned
  // here, once the file-then-registration order is settled, because that is the
  // only place both halves are known.
  collected.forEach((entry, index) => {
    entry.sequence = index;
  });

  for (const entry of collected) {
    const { registration } = entry;

    if (registration.kind === 'beforeAll' || registration.kind === 'afterAll') {
      runScoped[registration.kind].push(entry);

      continue;
    }

    if (
      registration.kind === 'authorize' &&
      registration.target === undefined
    ) {
      globalAuthorize.push(entry);

      continue;
    }

    const selectors = selectorsOf(registration.target);

    if (!selectors) {
      diagnostics.push({
        file: entry.file,
        exportName: entry.exportName,
        reason: `${registration.kind} was given a target that is neither a selector nor a list of selectors`,
      });

      continue;
    }

    if (selectors.length === 0) {
      diagnostics.push({
        file: entry.file,
        exportName: entry.exportName,
        reason: `${registration.kind} was given an empty list of selectors, so it targets nothing`,
      });

      continue;
    }

    for (const selector of selectors) {
      const transaction = catalog.tryResolve(selector);

      if (!transaction) {
        diagnostics.push({
          file: entry.file,
          exportName: entry.exportName,
          reason: `${registration.kind} targets the selector "${selector}", which names no transaction in the loaded API description`,
          suggestions: catalog.nearMissSuggestions(parseSelector(selector)),
        });

        continue;
      }

      let hooks = byTransactionId.get(transaction.transactionId);

      if (!hooks) {
        hooks = emptyTransactionHooks();
        byTransactionId.set(transaction.transactionId, hooks);
      }

      // `defineSample` is set-once per Transaction. A second one is a conflict
      // rather than a last-wins override, and it is reported at load time —
      // not when that Transaction happens to be sampled — because the mistake
      // exists whether or not the run reaches it.
      const conflicting = hooks.defineSample[0];

      if (registration.kind === 'defineSample' && conflicting) {
        conflicts.push({
          file: entry.file,
          exportName: entry.exportName,
          reason: `defineSample is already defined for the selector "${selector}" by "${conflicting.exportName}" in ${conflicting.file}; a Transaction can have only one`,
          suggestions: [
            'Merge the two into one defineSample, or target a different selector.',
          ],
        });

        continue;
      }

      hooks[registration.kind].push(entry);
    }
  }

  return {
    files: files.map(({ key }) => key),
    byTransactionId,
    runScoped,
    globalAuthorize,
    diagnostics,
    conflicts,
    warnings,
  };
}
