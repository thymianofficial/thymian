import { readdir, realpath } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isThymianError, ThymianBaseError } from '@thymian/core';
import { createJiti, type Jiti } from 'jiti';

import type { TransactionCatalog } from '../selectors/transaction-catalog.js';
import { entryExists } from '../utils.js';
import {
  type AfterEachCallback,
  type AuthorizeCallback,
  type BeforeEachCallback,
  HOOK_KINDS,
  hookCreationLog,
  type HookRegistration,
  type HookTarget,
  isHookRegistration,
  type SampleCallback,
  type TransactionFilter,
} from './hook-registration.js';

/**
 * `@thymian/hooks` is resolved by **this** alias, not by the tsconfig `paths` entry
 * and not by a committed `.d.ts`, which is what lets a hook file import runtime
 * values in a workspace with no `.thymian/sampler/generated/`, no generated
 * `tsconfig.json` and no `sampler init` ever run.
 *
 * Two properties are load-bearing:
 *
 * - **Absolute path, never a bare specifier.** `package.json` exports only `"."`
 *   and `"./package.json"`, so `'@thymian/plugin-sampler/hook-api'` would be
 *   blocked by the exports map in a published install — and adding a subpath export
 *   would put an internal module on the package's public surface. Deriving the path
 *   from `import.meta.url` sidesteps the exports map entirely.
 * - **Extensionless.** jiti resolves `.js .mjs .cjs .ts .tsx .mts .cts .json` by
 *   default, so one target serves `dist/hook-api.js` in an installed CLI and
 *   `src/hook-api.ts` when running from source (Vitest), identically.
 */
const hooksRuntimeModule = fileURLToPath(
  new URL('./hook-api.js', import.meta.url),
).replace(/\.[cm]?js$/, '');

/** The specifier a hook file writes. */
export const HOOKS_RUNTIME_SPECIFIER = '@thymian/hooks';

/** Exposed for the alias test; nothing else should need it. */
export function hooksRuntimeModulePath(): string {
  return hooksRuntimeModule;
}

export type HookDiagnosticSeverity = 'error' | 'info';

/**
 * One resolution outcome. This array is the **shared** surface: `thymian test`
 * fails on its errors and 575.10's `sampler validate` renders the same array — so
 * there is no second reporting path to keep in step.
 */
export type HookDiagnostic = {
  severity: HookDiagnosticSeverity;
  /** Hooks-dir-relative, `/`-normalized. */
  file: string;
  kind?: string;
  /** The target as authored, rendered for a human. */
  anchor?: string;
  exportName?: string;
  reason: string;
  suggestions?: string[];
  cause?: unknown;
};

/** What binds to one transaction. */
export type TransactionHooks = {
  beforeEach: BeforeEachCallback[];
  afterEach: AfterEachCallback[];
  /**
   * At most one: spec §8 binds `targeted.get(id) ?? global`, and two candidates at
   * the same precedence are a conflict rather than a composition.
   */
  authorize?: AuthorizeCallback;
};

/**
 * A registration plus the two things only the loader knows. Every AC 6 / AC 7
 * message is built from this envelope, which is why `sourceFile` is not a field on
 * the registration record itself.
 */
export type CollectedRegistration = {
  registration: HookRegistration;
  /** Hooks-dir-relative, `/`-normalized. */
  file: string;
  exportName: string;
};

export type LoadUserHooksResult = {
  perTransaction: Map<string, TransactionHooks>;
  sampleDefinitions: Map<string, SampleCallback>;
  /** Collected in registration order for 575.8's pipeline. Never invoked here. */
  runScoped: {
    beforeAll: CollectedRegistration[];
    afterAll: CollectedRegistration[];
  };
  diagnostics: HookDiagnostic[];
  hasErrors: boolean;
  /** How many hook files were scanned. `logger.debug` material, not a diagnostic. */
  fileCount: number;
};

/**
 * Keep a file iff its name is a JS/TS module and not a declaration file.
 *
 * `.tsx` is deliberately not matched — spec §2 says `.ts`/`.js`.
 */
export function isHookFile(name: string): boolean {
  if (/\.d\.[cm]?ts$/.test(name)) {
    return false;
  }

  return /\.[cm]?[jt]s$/.test(name);
}

type HookFile = {
  /** Hooks-dir-relative, `/`-normalized. The sort key and the diagnostic label. */
  key: string;
  full: string;
};

function hooksDirRelative(hooksDir: string, full: string): string {
  return relative(hooksDir, full).split(/[/\\]/).join('/');
}

/**
 * UTF-16 code-unit order, not `localeCompare`.
 *
 * AC 2 is *about* cross-platform determinism, and `localeCompare` without an
 * explicit locale reads the host default locale and the host ICU build — the two
 * things that differ between the `ubuntu-latest`, `windows-2022` and
 * `macos-latest` CI legs. A plain relational comparison is the same everywhere.
 */
function compareKeys(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}

/**
 * Every hook file under `hooksDir`, deepest-first-agnostic and sorted by
 * hooks-dir-relative path.
 *
 * Symlinked directories are not followed: `readdir({recursive:true})` does not
 * descend them. Accepted, not worked around.
 */
async function collectHookFiles(hooksDir: string): Promise<HookFile[]> {
  const files: HookFile[] = [];

  for (const dirent of await readdir(hooksDir, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!dirent.isFile() || !isHookFile(dirent.name)) {
      continue;
    }

    const full = join(dirent.parentPath, dirent.name);
    const key = hooksDirRelative(hooksDir, full);
    const segments = key.split('/');

    // Dot-*subdirectories* only. Spec §2 excludes dot-directories, so
    // `hooks/.hidden/a.ts` is skipped while `hooks/.eslintrc.ts` is kept — the
    // filename itself is not subject to the rule. Computed on the hooks-dir-
    // relative path, so a dot-segment in an ancestor (a checkout under
    // `.worktrees/`, a repo under `.config/`) never excludes anything.
    if (segments.slice(0, -1).some((segment) => segment.startsWith('.'))) {
      continue;
    }

    files.push({ key, full });
  }

  return files.sort((a, b) => compareKeys(a.key, b.key));
}

function messageOf(error: unknown): string {
  if (isThymianError(error)) {
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

function suggestionsOf(error: unknown): string[] | undefined {
  return isThymianError(error) ? error.options.suggestions : undefined;
}

/**
 * `Array.isArray` alone does not remove `readonly Selector[]` from the union, so
 * the filter branch would still see it. One guard, used by both readers.
 */
function isSelectorList(target: HookTarget): target is readonly string[] {
  return Array.isArray(target);
}

/** The target as authored, rendered for a diagnostic. */
export function describeTarget(target: HookTarget | undefined): string {
  if (target === undefined) {
    return 'global';
  }

  if (typeof target === 'string') {
    return `"${target}"`;
  }

  if (isSelectorList(target)) {
    return `[${target.map((selector) => `"${String(selector)}"`).join(', ')}]`;
  }

  try {
    return JSON.stringify(target) ?? String(target);
  } catch {
    // A filter is user data and may be circular or carry a throwing accessor.
    return '[unprintable filter]';
  }
}

type TargetResolution =
  | { ok: true; ids: string[] }
  | { ok: false; error: string; suggestions?: string[] };

/**
 * The single story-575.4 (#580) integration point.
 *
 * Until filter matching lands this returns nothing, and the zero-match rule below
 * turns that into an error — so a filter never silently binds to everything or to
 * nothing. When 575.4 lands it routes through the shared matcher (ADR-0019's
 * shipping condition for globs, spec §5.1); no second glob or filter
 * implementation belongs here.
 */
function matchTransactionFilter(
  filter: TransactionFilter,
  catalog: TransactionCatalog,
): string[] {
  // Both parameters are the signature 575.4 needs; referenced so the seam is not
  // a lint warning that someone "cleans up" by deleting it.
  void filter;
  void catalog;

  return [];
}

/**
 * Resolves a target to transaction ids **at load time**, before any request is
 * dispatched.
 *
 * A dangling selector is never auto-rebound to a "nearest" transaction — the
 * suggestions in the error text come from 575.2's catalog and are advice, not a
 * fallback.
 */
function resolveTargeting(
  target: HookTarget,
  catalog: TransactionCatalog,
): TargetResolution {
  if (typeof target === 'string') {
    try {
      // A selector is bijective (spec §3), so this yields exactly one
      // transaction or throws. Resolution is a map lookup; the parse that builds
      // the suggestion list happens only after the miss.
      return { ok: true, ids: [catalog.resolve(target).transactionId] };
    } catch (error) {
      return {
        ok: false,
        error: messageOf(error),
        suggestions: suggestionsOf(error),
      };
    }
  }

  if (isSelectorList(target)) {
    const selectors = target;

    if (selectors.length === 0) {
      return {
        ok: false,
        error: 'targets an empty selector list, so it can never run',
        suggestions: [
          'Name at least one selector, or delete the hook if it is no longer needed.',
        ],
      };
    }

    const ids: string[] = [];
    const failures: string[] = [];
    let suggestions: string[] | undefined;

    for (const selector of selectors) {
      try {
        ids.push(catalog.resolve(selector).transactionId);
      } catch (error) {
        failures.push(`"${selector}" — ${messageOf(error)}`);
        suggestions ??= suggestionsOf(error);
      }
    }

    if (failures.length > 0) {
      return {
        ok: false,
        error: `${failures.length} of ${selectors.length} selector(s) do not resolve: ${failures.join('; ')}`,
        suggestions,
      };
    }

    return { ok: true, ids };
  }

  const matched = matchTransactionFilter(target, catalog);

  // Spec §5 / §12 AC 2: a filter whose values are valid but which matches zero
  // transactions is an error, phrased as data the user can act on.
  if (matched.length === 0) {
    return {
      ok: false,
      error: `matched none of the ${catalog.size} loaded transaction(s)`,
      suggestions: [
        'Check the filter against the loaded API description, or replace it with a selector.',
      ],
    };
  }

  return { ok: true, ids: matched };
}

function emptyTransactionHooks(): TransactionHooks {
  return { beforeEach: [], afterEach: [] };
}

function hooksFor(
  perTransaction: Map<string, TransactionHooks>,
  transactionId: string,
): TransactionHooks {
  const existing = perTransaction.get(transactionId);

  if (existing) {
    return existing;
  }

  const created = emptyTransactionHooks();
  perTransaction.set(transactionId, created);

  return created;
}

/**
 * Imports one hook file and collects every export that is a registration.
 *
 * Collection is **by object identity**: `export default r` plus
 * `export const alias = r`, and jiti's `interopDefault` surfacing a CJS
 * `module.exports` both as `default` and as spread named keys, both reach the same
 * object twice. Without the dedupe a single `defineSample` becomes a phantom AC 7
 * duplicate.
 *
 * `seen` is owned by the **scan**, not by this call, so the dedupe also spans
 * files. A shared hook module (`export { shared } from './lib.js'`) is reachable
 * from both `a.ts` and `lib.ts`; per-file dedupe bound it twice and would have
 * turned one shared `defineSample` into a cross-file conflict that the user cannot
 * fix. First file in sort order wins the attribution, and it is a file that really
 * does export the value.
 */
async function importRegistrations(
  jiti: Jiti,
  file: HookFile,
  diagnostics: HookDiagnostic[],
  seen: Set<unknown>,
): Promise<{
  collected: CollectedRegistration[];
  created: HookRegistration[];
}> {
  const log = hookCreationLog();
  const collected: CollectedRegistration[] = [];

  let mod: Record<string, unknown> | undefined;
  let created: HookRegistration[] = [];

  log.created.length = 0;

  try {
    // No `{ default: true }`: that option (v1's `tryImport`) collapses the
    // namespace to the default export and would discard every named
    // registration. `interopDefault` stays on, which is what makes a CJS hook
    // file's `module.exports` appear as namespace keys.
    mod = await jiti.import<Record<string, unknown>>(file.full);
  } catch (error) {
    // One broken file must not hide the other nine.
    diagnostics.push({
      severity: 'error',
      file: file.key,
      reason: `could not be imported — ${messageOf(error)}`,
      cause: error,
    });
  } finally {
    created = [...log.created];
    log.created.length = 0;
  }

  const take = (value: unknown, exportName: string): void => {
    if (!isHookRegistration(value) || seen.has(value)) {
      return;
    }

    seen.add(value);

    // Read the discriminant raw: `isHookRegistration` only proves the brand, so
    // the narrowed type is a claim about `kind` that a version-skewed runtime can
    // falsify. Dropping such a value silently would turn a plugin/hooks mismatch
    // into hooks that simply never fire.
    const kind: unknown = (value as { kind?: unknown }).kind;

    if (typeof kind !== 'string' || !HOOK_KINDS.has(kind)) {
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        kind: typeof kind === 'string' ? kind : String(kind),
        reason: `export "${exportName}" is a hook registration of an unrecognised kind "${String(kind)}"`,
        suggestions: [
          'Check that @thymian/plugin-sampler and the @thymian/hooks runtime your hook resolved are the same version.',
        ],
      });

      return;
    }

    collected.push({ registration: value, file: file.key, exportName });
  };

  for (const [exportName, value] of Object.entries(mod ?? {})) {
    if (Array.isArray(value)) {
      // One level, element-wise, no deep flattening. A *nested* array is not
      // discovered; it surfaces through the created-but-not-exported diagnostic
      // instead, which is the intended interlock rather than a gap.
      value.forEach((element, index) =>
        take(element, `${exportName}[${index}]`),
      );
    } else {
      // `default` is one key of the namespace like any other.
      take(value, exportName);
    }
  }

  return { collected, created };
}

function conflict(
  kindLabel: string,
  first: CollectedRegistration,
  second: CollectedRegistration,
  what: string,
): HookDiagnostic {
  return {
    severity: 'error',
    file: second.file,
    kind: kindLabel,
    anchor: describeTarget(targetOf(second.registration)),
    exportName: second.exportName,
    reason: `${what} is already set by "${first.exportName}" in "${first.file}"`,
    suggestions: [
      'Keep one of the two hooks, or narrow their targets so they do not overlap.',
    ],
  };
}

function targetOf(registration: HookRegistration): HookTarget | undefined {
  // Switch on `kind` first: `beforeAll`/`afterAll` carry no `target` property at
  // all, so probing for the key would be reading a shape that does not exist.
  switch (registration.kind) {
    case 'defineSample':
    case 'beforeEach':
    case 'afterEach':
    case 'authorize':
      return registration.target;
    case 'beforeAll':
    case 'afterAll':
      return undefined;
  }
}

/**
 * Loads every hook under `hooksDir` and resolves its targeting against `catalog`.
 *
 * Never throws for user error: every failure becomes a diagnostic and `hasErrors`
 * tells the caller to stop. A missing hooks directory is not an error — it yields
 * zero hooks and zero diagnostics, which is what makes a workspace with no hooks a
 * clean pass-through.
 */
export async function loadUserHooks(
  hooksDir: string,
  catalog: TransactionCatalog,
): Promise<LoadUserHooksResult> {
  const diagnostics: HookDiagnostic[] = [];
  const perTransaction = new Map<string, TransactionHooks>();
  const sampleDefinitions = new Map<string, SampleCallback>();
  const runScoped: LoadUserHooksResult['runScoped'] = {
    beforeAll: [],
    afterAll: [],
  };

  const empty = (): LoadUserHooksResult => ({
    perTransaction,
    sampleDefinitions,
    runScoped,
    diagnostics,
    hasErrors: diagnostics.some(
      (diagnostic) => diagnostic.severity === 'error',
    ),
    fileCount: 0,
  });

  if (!(await entryExists(hooksDir))) {
    return empty();
  }

  // Scan the *real* path, not the path as given.
  //
  // jiti derives a nested specifier's cache key from the importing file's real
  // location, but keys a top-level `jiti.import(path)` on the path handed to it.
  // Through a symlinked ancestor — macOS's `/var` → `/private/var`, a symlinked
  // checkout or home directory — those two disagree, so a hook module imported
  // both directly by the scan and indirectly by a sibling gets evaluated
  // **twice**, producing two distinct registrations for one authored hook. That
  // defeats the identity dedupe below and turns a shared `defineSample` into a
  // phantom cross-file conflict the user cannot fix. One `realpath` makes the two
  // keys agree.
  let scanRoot = hooksDir;

  try {
    scanRoot = await realpath(hooksDir);
  } catch {
    // A path we could `access()` but not `realpath()`. Keep the original; the
    // scan below reports anything genuinely unreadable.
  }

  let files: HookFile[];

  try {
    files = await collectHookFiles(scanRoot);
  } catch (error) {
    // The path exists but is not a walkable directory (a plain file at
    // `hooks`, an unreadable mode). The user asked for hooks, so this is an
    // error rather than a silent zero — but it is a diagnostic, not an
    // exception out of `core.format`.
    diagnostics.push({
      severity: 'error',
      file: '',
      reason: `the hooks directory "${hooksDir}" could not be read — ${messageOf(error)}`,
      cause: error,
    });

    return empty();
  }

  // Created inside the load, never at module scope: `moduleCache` and `fsCache`
  // both default to `true`, so a module-scope instance leaks compiled hook
  // modules between Vitest cases in the same worker and makes tests
  // order-dependent.
  const jiti = createJiti(import.meta.url, {
    alias: { [HOOKS_RUNTIME_SPECIFIER]: hooksRuntimeModule },
  });

  const collected: CollectedRegistration[] = [];
  const createdPerFile: { file: string; created: HookRegistration[] }[] = [];
  const seen = new Set<unknown>();

  for (const file of files) {
    const result = await importRegistrations(jiti, file, diagnostics, seen);

    collected.push(...result.collected);
    createdPerFile.push({ file: file.key, created: result.created });
  }

  // AC 2: files order by relative path, registrations order by their creation
  // index within a file. `Object.entries` does not yield source order — an ESM
  // namespace exposes its string keys sorted and jiti's compiled namespace
  // yields emit order — so composition order has to come from `order`.
  collected.sort(
    (a, b) =>
      compareKeys(a.file, b.file) ||
      a.registration.order - b.registration.order,
  );

  reportUnexportedRegistrations(createdPerFile, collected, diagnostics);

  bindRegistrations(
    collected,
    catalog,
    perTransaction,
    sampleDefinitions,
    runScoped,
    diagnostics,
  );

  return {
    perTransaction,
    sampleDefinitions,
    runScoped,
    diagnostics,
    hasErrors: diagnostics.some(
      (diagnostic) => diagnostic.severity === 'error',
    ),
    fileCount: files.length,
  };
}

/**
 * Reports registrations the user built but never exported —
 * `beforeEach(sel, fn);` on its own line does nothing, because §9 discovery is
 * export-based.
 *
 * The diff is taken **across the whole scan**, not per file. Per-file diffing
 * looks right and is wrong: when `a.ts` imports `lib.ts`, jiti evaluates `lib.ts`
 * inside `a.ts`'s import window, so `lib.ts`'s registrations are "created during
 * a.ts" while being exported from `lib.ts` — a false positive on every shared hook
 * module. Attribution still names the import window that created the value, which
 * is the only file the loader can honestly point at.
 */
function reportUnexportedRegistrations(
  createdPerFile: { file: string; created: HookRegistration[] }[],
  collected: CollectedRegistration[],
  diagnostics: HookDiagnostic[],
): void {
  const exported = new Set<HookRegistration>(
    collected.map((entry) => entry.registration),
  );

  for (const { file, created } of createdPerFile) {
    const missing = created.filter(
      (registration) => !exported.has(registration),
    );

    if (missing.length === 0) {
      continue;
    }

    diagnostics.push({
      severity: 'error',
      file,
      reason: `${missing.length} registration(s) created while loading "${file}" but not exported; assign them to an export (e.g. \`export const authLogin = beforeEach(…)\`)`,
      suggestions: [
        "Hooks are discovered from a file's exports. A registration that is only created, or that sits inside a nested array, is never loaded.",
      ],
    });
  }
}

function bindRegistrations(
  collected: CollectedRegistration[],
  catalog: TransactionCatalog,
  perTransaction: Map<string, TransactionHooks>,
  sampleDefinitions: Map<string, SampleCallback>,
  runScoped: LoadUserHooksResult['runScoped'],
  diagnostics: HookDiagnostic[],
): void {
  const sampleOwner = new Map<string, CollectedRegistration>();
  const targetedAuthorize = new Map<string, CollectedRegistration>();
  const targetedAuthorizeCallback = new Map<string, AuthorizeCallback>();
  let globalAuthorize: CollectedRegistration | undefined;
  let globalAuthorizeCallback: AuthorizeCallback | undefined;
  let matched = 0;

  const resolve = (
    entry: CollectedRegistration,
    target: HookTarget,
  ): string[] | undefined => {
    const anchor = describeTarget(target);
    const resolution = resolveTargeting(target, catalog);

    if (!resolution.ok) {
      diagnostics.push({
        severity: 'error',
        file: entry.file,
        kind: entry.registration.kind,
        anchor,
        exportName: entry.exportName,
        reason: resolution.error,
        suggestions: resolution.suggestions,
      });

      return undefined;
    }

    matched += 1;

    diagnostics.push({
      severity: 'info',
      file: entry.file,
      kind: entry.registration.kind,
      anchor,
      exportName: entry.exportName,
      reason: `resolved to ${resolution.ids.length} transaction(s)`,
    });

    return resolution.ids;
  };

  for (const entry of collected) {
    const { registration } = entry;

    switch (registration.kind) {
      case 'beforeAll':
        runScoped.beforeAll.push(entry);
        break;

      case 'afterAll':
        runScoped.afterAll.push(entry);
        break;

      case 'defineSample': {
        const ids = resolve(entry, registration.target);

        if (!ids) {
          break;
        }

        for (const id of ids) {
          const owner = sampleOwner.get(id);

          if (owner) {
            // Set-once per transaction. 575.6 declares it; this story enforces
            // it, because load time is the only place the target → transaction
            // mapping exists.
            diagnostics.push(
              conflict(
                'defineSample',
                owner,
                entry,
                "that transaction's sample",
              ),
            );
            continue;
          }

          sampleOwner.set(id, entry);
          sampleDefinitions.set(id, registration.callback);
        }

        break;
      }

      case 'beforeEach': {
        const ids = resolve(entry, registration.target);

        for (const id of ids ?? []) {
          hooksFor(perTransaction, id).beforeEach.push(registration.callback);
        }

        break;
      }

      case 'afterEach': {
        const ids = resolve(entry, registration.target);

        for (const id of ids ?? []) {
          hooksFor(perTransaction, id).afterEach.push(registration.callback);
        }

        break;
      }

      case 'authorize': {
        if (registration.target === undefined) {
          // `target: undefined` *is* the global form. There is no second boolean.
          if (globalAuthorize) {
            diagnostics.push(
              conflict(
                'authorize',
                globalAuthorize,
                entry,
                'the global authorize hook',
              ),
            );
            break;
          }

          globalAuthorize = entry;
          globalAuthorizeCallback = registration.callback;
          break;
        }

        const ids = resolve(entry, registration.target);

        for (const id of ids ?? []) {
          const owner = targetedAuthorize.get(id);

          if (owner) {
            diagnostics.push(
              conflict(
                'authorize',
                owner,
                entry,
                "that transaction's authorize hook",
              ),
            );
            continue;
          }

          targetedAuthorize.set(id, entry);
          targetedAuthorizeCallback.set(id, registration.callback);
        }

        break;
      }
    }
  }

  // Spec §8: a targeted `authorize` wins over the global one for the transactions
  // it covers; the global still covers the rest. Bound for every transaction in
  // the catalog so precedence is decided here, once, rather than at request time.
  for (const [, transaction] of catalog.entries()) {
    const bound =
      targetedAuthorizeCallback.get(transaction.transactionId) ??
      globalAuthorizeCallback;

    if (bound) {
      hooksFor(perTransaction, transaction.transactionId).authorize = bound;
    }
  }

  if (matched > 0) {
    diagnostics.push({
      severity: 'info',
      file: '',
      reason: `${matched} hook target(s) resolved against ${catalog.size} transaction(s)`,
    });
  }
}

function formatDiagnostic(diagnostic: HookDiagnostic): string {
  const parts = [diagnostic.file || '<hooks>'];
  const head = [diagnostic.kind, diagnostic.anchor]
    .filter((part) => part !== undefined && part !== '')
    .join(' ');

  return `${parts.join('')}: ${head ? `${head} — ` : ''}${diagnostic.reason}`;
}

/**
 * The single error a failed load throws. Every offending hook is listed, one per
 * line — a user who renamed a path wants all six broken hooks in one message, not
 * six edit-run cycles.
 *
 * No `ref:` is set: a `ref` pointing at a page that does not exist is worse than
 * no `ref`, and this story adds no `astro-docs` error page.
 */
export function hookResolutionError(
  diagnostics: HookDiagnostic[],
): ThymianBaseError {
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  const suggestions = [
    ...new Set(errors.flatMap((diagnostic) => diagnostic.suggestions ?? [])),
  ];

  return new ThymianBaseError(
    `${errors.length} sampler hook problem(s) must be fixed before a test run can start:\n${errors
      .map((diagnostic) => `  ${formatDiagnostic(diagnostic)}`)
      .join('\n')}`,
    {
      name: 'HookResolutionError',
      suggestions,
    },
  );
}
