import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isThymianError, ThymianBaseError } from '@thymian/core';
import { createJiti, type Jiti, type ModuleCache } from 'jiti';

import type { TransactionCatalog } from '../selectors/transaction-catalog.js';
import { entryExists } from '../utils.js';
import {
  type AfterEachCallback,
  type AuthorizeCallback,
  type BeforeEachCallback,
  HOOK_KINDS,
  HOOK_REGISTRATION,
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
 *
 * `registration` is a **snapshot**, not the object the user's module exported.
 * Every field is read exactly once, behind a guard, in {@link importRegistrations}
 * — an export is user data and may be a Proxy whose accessors throw, or whose
 * second read returns something different from the first. Everything downstream
 * (the sort, `targetOf`, `bindRegistrations`, every diagnostic) reads the
 * snapshot, so there is exactly one place where a user value can misbehave and it
 * is a place that turns misbehaviour into a per-file diagnostic.
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
  /**
   * How many registrations actually bound to something.
   *
   * Not `perTransaction.size`: one global `authorize` binds every transaction in
   * the catalog, so the map's size counts the *catalog*, not the hooks. An
   * operator reading "1 hook bound across 240 transaction(s)" learns something;
   * "240 transaction hook binding(s)" reads as 240 hooks.
   */
  boundHookCount: number;
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
 * Symlinked **directories** are not followed: `readdir({recursive:true})` does not
 * descend them. Accepted, not worked around.
 *
 * Symlinked **files** are followed. `readdir({withFileTypes:true})` reports
 * `lstat` semantics, so a symlink answers `isSymbolicLink()` and never
 * `isFile()` — a monorepo that symlinks a shared hook file into
 * `.thymian/sampler/hooks/` would otherwise have that hook silently dropped
 * before `isHookFile` ever ran: no diagnostic, and not even counted in
 * `fileCount`. One `stat` per symlink (not per entry) resolves the target; a
 * symlink that cannot be resolved is a diagnostic rather than a silent skip,
 * because a dangling link named `auth.ts` is exactly the case where "nothing
 * happened" is the wrong answer.
 */
async function collectHookFiles(
  hooksDir: string,
  diagnostics: HookDiagnostic[],
): Promise<HookFile[]> {
  const files: HookFile[] = [];

  for (const dirent of await readdir(hooksDir, {
    recursive: true,
    withFileTypes: true,
  })) {
    const isLink = dirent.isSymbolicLink();

    if ((!dirent.isFile() && !isLink) || !isHookFile(dirent.name)) {
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

    if (isLink) {
      let target: Awaited<ReturnType<typeof stat>>;

      try {
        target = await stat(full);
      } catch (error) {
        diagnostics.push({
          severity: 'error',
          file: key,
          reason: `is a symbolic link that could not be resolved — ${messageOf(error)}`,
          suggestions: [
            'Point the link at an existing file, or remove it from the hooks directory.',
          ],
          cause: error,
        });

        continue;
      }

      if (!target.isFile()) {
        continue;
      }
    }

    files.push({ key, full });
  }

  return files.sort((a, b) => compareKeys(a.key, b.key));
}

/**
 * `String(value)` on a user-controlled value, without the throw.
 *
 * `String(x)` invokes `Symbol.toPrimitive`, then `toString`, then `valueOf` — all
 * three are user code on a Proxy or a hand-rolled object, and all three may throw.
 * Every place this module renders a user value into a message goes through here.
 */
function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unprintable value]';
  }
}

function messageOf(error: unknown): string {
  if (isThymianError(error)) {
    return error.message;
  }

  return error instanceof Error ? error.message : safeString(error);
}

/**
 * `isThymianError` deliberately accepts a value with **no own `options`**
 * (`thymian.error.ts:20-32`), so `isThymianError(new Error('x'))` is `true` and a
 * bare `error.options.suggestions` is a `TypeError` — thrown from inside the catch
 * block that exists to turn a resolution failure into a diagnostic. Latent only
 * while `TransactionCatalog.resolve` throws `ThymianBaseError` exclusively; the
 * 575.4 filter seam at {@link matchTransactionFilter} can raise anything.
 *
 * The array is also checked element-wise: `suggestions` reaches
 * `hookResolutionError`, which joins it into the one message a user sees.
 */
function suggestionsOf(error: unknown): string[] | undefined {
  if (!isThymianError(error)) {
    return undefined;
  }

  const suggestions: unknown = error.options?.suggestions;

  if (
    !Array.isArray(suggestions) ||
    !suggestions.every((suggestion) => typeof suggestion === 'string')
  ) {
    return undefined;
  }

  return suggestions;
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
    try {
      // Inside the `try`, not next to it: `target` is user data even when it is
      // an array. `map` on a Proxy array invokes the `get` trap per index, and
      // `String(selector)` invokes a `Symbol.toPrimitive` the user wrote — the
      // old code did both outside any guard, so one exotic element threw all the
      // way out of `loadUserHooks`.
      return `[${target
        .map((selector) => `"${safeString(selector)}"`)
        .join(', ')}]`;
    } catch {
      return '[unprintable selector list]';
    }
  }

  try {
    return JSON.stringify(target) ?? safeString(target);
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
        // `safeString`, not interpolation: a selector list is user data, and an
        // element with a throwing `Symbol.toPrimitive` reaches here *because*
        // `catalog.resolve` coerced it and the coercion threw. Interpolating it
        // into the failure message threw the same error a second time, straight
        // out of the catch block that exists to report it.
        failures.push(`"${safeString(selector)}" — ${messageOf(error)}`);
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

    // `defineSample([X, X], fn)` otherwise resolves to the same transaction
    // twice, and the set-once check downstream then reports the hook as its own
    // rival — `that transaction's sample is already set by "s" in "dup.ts"`,
    // naming the file the user is looking at. `beforeEach`/`afterEach` have no
    // owner check at all, so the callback simply ran twice per request with
    // nothing said. Deduping here fixes every kind at once, and the info
    // diagnostic then reports the number of transactions actually bound.
    return { ok: true, ids: [...new Set(ids)] };
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

  return { ok: true, ids: [...new Set(matched)] };
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
 * A module cache owned by **one scan**.
 *
 * jiti's own `moduleCache` is not per-instance: `moduleCache: true` makes jiti
 * delegate to Node's `require.cache`, which is keyed on resolved filename and
 * lives on the *process*. Building the `Jiti` instance inside `loadUserHooks`
 * therefore isolated nothing — a second load in the same process re-served the
 * first load's compiled modules, so an edited hook file kept reporting its old
 * selector and a file with an unexported registration lost its diagnostic
 * entirely (the module body never re-executes, so `registerHook` never fires and
 * the creation log stays empty). That is the long-lived `core.workflow.test`
 * case the `#614` docblock in `hook-runner.ts` names, and it is what would make
 * 575.10's `sampler validate` report a false clean.
 *
 * So the cache is ours: `moduleCache: false` stops jiti touching `require.cache`,
 * and this object — handed to `jiti.evalModule` as its `cache` — takes over the
 * job for the duration of one scan. jiti threads it down the whole import graph
 * (each module's child instance inherits it as `parentCache`), so a shared
 * `lib.ts` reached from `a.ts` is evaluated once; {@link evaluateModule} adds the
 * one check jiti does not do for a *top-level* call, and that check is what keeps
 * `a.ts` and a directly-scanned `lib.ts` on one evaluation.
 */
type ScanModuleCache = ModuleCache;

/**
 * Evaluates one hook file, at most once per scan, and returns its namespace.
 *
 * The key is jiti's own resolution of the path, not the path as read from
 * `readdir`, because that is the key jiti stores under when a *sibling* module
 * imports the same file. Two spellings of one file would otherwise be two
 * evaluations, which is the defect the identity dedupe below cannot see: two
 * evaluations produce two distinct registration objects for one authored hook.
 */
async function evaluateModule(
  jiti: Jiti,
  moduleCache: ScanModuleCache,
  full: string,
): Promise<unknown> {
  let resolved = full;

  try {
    // `esmResolve` returns a `file://` URL; the cache is keyed on the plain path.
    resolved = fileURLToPath(jiti.esmResolve(full));
  } catch {
    // Unresolvable: fall through and let the read below produce the diagnostic.
  }

  const cached: { exports: unknown } | undefined = moduleCache[resolved];

  if (cached) {
    // Already evaluated in this scan, as some earlier file's dependency. Its
    // exports are the same objects that file saw, so the identity dedupe in
    // `take` collapses the two sightings into one registration — which is what
    // keeps a shared hook module from becoming a cross-file conflict.
    return cached.exports;
  }

  return await jiti.evalModule(await readFile(resolved, 'utf-8'), {
    filename: resolved,
    ext: extname(resolved),
    cache: moduleCache,
    async: true,
  });
}

/** Every field of a registration, read once, behind one guard. */
type RegistrationFields = {
  kind: unknown;
  order: unknown;
  target: unknown;
  callback: unknown;
};

/**
 * Rebuilds a registration from fields already read.
 *
 * `beforeAll`/`afterAll` are rebuilt **without a `target` key** rather than with
 * `target: undefined`: the registration contract says those two kinds carry no
 * `target` property at all, and on `authorize` `target: undefined` *is* the
 * global form — a snapshot that blurred the two would hand 575.8 a shape the
 * contract says cannot exist.
 *
 * A non-numeric `order` sorts **last** within its file rather than first. It can
 * only come from a hand-rolled or skewed branded value, and putting an unknown
 * creation index ahead of the hooks the user really did author would silently
 * change their composition order.
 */
function snapshotRegistration(
  kind: string,
  fields: RegistrationFields,
): HookRegistration {
  const order =
    typeof fields.order === 'number' && Number.isFinite(fields.order)
      ? fields.order
      : Number.MAX_SAFE_INTEGER;

  const base =
    kind === 'beforeAll' || kind === 'afterAll'
      ? { kind, order, callback: fields.callback }
      : { kind, order, target: fields.target, callback: fields.callback };

  return Object.freeze({
    ...base,
    [HOOK_REGISTRATION]: true,
  }) as HookRegistration;
}

/**
 * Imports one hook file and collects every export that is a registration.
 *
 * **Nothing here reads a user value without a guard.** The namespace, each export
 * name, each export value, each element of an exported array and each field of a
 * branded object are all user-controlled: a CJS re-export can carry an enumerable
 * throwing getter, an export can be a Proxy that throws on `ownKeys` or on any
 * property read, and a branded value can be a Proxy whose `kind` or `callback`
 * accessor throws. Every one of those used to throw straight out of
 * `loadUserHooks` → `HookRunner.init` → `core.format` as an unformatted error
 * with no `file:` attribution, breaking this module's two stated contracts:
 * "never throws for user error" and "one broken file must not hide the other
 * nine". `isHookRegistration` already tolerates a throwing property access
 * (`hook-registration.ts:239-243`); everything downstream of it now does too.
 *
 * The guards are per-export, not one `try` around the loop, so one throwing
 * getter costs the user that one export and not the other nine.
 *
 * Collection is **by object identity**: `export default r` plus
 * `export const alias = r`, and jiti's `interopDefault` surfacing a CJS
 * `module.exports` both as `default` and as spread named keys, both reach the
 * same object twice. Without the dedupe a single `defineSample` becomes a phantom
 * AC 7 duplicate.
 *
 * `exported` is owned by the **scan**, not by this call, so the dedupe also spans
 * files. A shared hook module (`export { shared } from './lib.js'`) is reachable
 * from both `a.ts` and `lib.ts` — one module, one evaluation, one object, seen
 * twice. First file in sort order wins the attribution, and it is a file that
 * really does export the value. The same set is what
 * {@link reportUnexportedRegistrations} diffs against, so a branded value that was
 * found as an export but rejected for some other reason still counts as exported.
 */
async function importRegistrations(
  jiti: Jiti,
  moduleCache: ScanModuleCache,
  file: HookFile,
  diagnostics: HookDiagnostic[],
  exported: Set<unknown>,
): Promise<{
  collected: CollectedRegistration[];
  created: HookRegistration[];
  importFailed: boolean;
}> {
  const log = hookCreationLog();
  const collected: CollectedRegistration[] = [];

  let mod: unknown;
  let created: HookRegistration[] = [];
  let importFailed = false;

  log.created.length = 0;

  try {
    // No `{ default: true }`: that option (v1's `tryImport`) collapses the
    // namespace to the default export and would discard every named
    // registration. `interopDefault` stays on, which is what makes a CJS hook
    // file's `module.exports` appear as namespace keys.
    mod = await evaluateModule(jiti, moduleCache, file.full);
  } catch (error) {
    // One broken file must not hide the other nine.
    importFailed = true;

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
    if (!isHookRegistration(value) || exported.has(value)) {
      return;
    }

    exported.add(value);

    const fields: RegistrationFields = {
      kind: undefined,
      order: undefined,
      target: undefined,
      callback: undefined,
    };

    try {
      // Read the discriminant raw: `isHookRegistration` only proves the brand,
      // so the narrowed type is a claim about `kind` that a version-skewed
      // runtime can falsify. Dropping such a value silently would turn a
      // plugin/hooks mismatch into hooks that simply never fire.
      fields.kind = (value as { kind?: unknown }).kind;
      fields.order = (value as { order?: unknown }).order;
      fields.target = (value as { target?: unknown }).target;
      fields.callback = (value as { callback?: unknown }).callback;
    } catch (error) {
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        reason: `export "${exportName}" carries the hook-registration brand but its fields could not be read — ${messageOf(error)}`,
        suggestions: [
          'Export the value the @thymian/hooks runtime returned, not a wrapper or a proxy around it.',
        ],
        cause: error,
      });

      return;
    }

    const kind = fields.kind;

    if (typeof kind !== 'string' || !HOOK_KINDS.has(kind)) {
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        kind: typeof kind === 'string' ? kind : safeString(kind),
        reason: `export "${exportName}" is a hook registration of an unrecognised kind "${safeString(kind)}"`,
        suggestions: [
          'Check that @thymian/plugin-sampler and the @thymian/hooks runtime your hook resolved are the same version.',
        ],
      });

      return;
    }

    if (typeof fields.callback !== 'function') {
      // Reached only by a hand-rolled or skewed branded value: the runtime's own
      // factories reject a non-callable callback. Binding it anyway would defer
      // the failure to the first request, long after the load-time report.
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        kind,
        reason: `export "${exportName}" is a ${kind} hook registration whose callback is not a function`,
        suggestions: [
          'Check that @thymian/plugin-sampler and the @thymian/hooks runtime your hook resolved are the same version.',
        ],
      });

      return;
    }

    collected.push({
      registration: snapshotRegistration(kind, fields),
      file: file.key,
      exportName,
    });
  };

  let keys: string[] = [];

  try {
    keys = mod === undefined || mod === null ? [] : Object.keys(mod);
  } catch (error) {
    diagnostics.push({
      severity: 'error',
      file: file.key,
      reason: `exports could not be enumerated — ${messageOf(error)}`,
      cause: error,
    });
  }

  for (const exportName of keys) {
    let value: unknown;

    try {
      value = (mod as Record<string, unknown>)[exportName];
    } catch (error) {
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        reason: `export "${exportName}" could not be read — ${messageOf(error)}`,
        cause: error,
      });

      continue;
    }

    if (Array.isArray(value)) {
      // One level, element-wise, no deep flattening. A *nested* array is not
      // discovered; it surfaces through the created-but-not-exported diagnostic
      // instead, which is the intended interlock rather than a gap.
      //
      // Indexed rather than `forEach`, and each read guarded: `Array.isArray` is
      // true for a Proxy whose target is an array, and both `length` and every
      // element read then run the user's `get` trap.
      let length = 0;

      try {
        length = (value as { length: number }).length;
      } catch (error) {
        diagnostics.push({
          severity: 'error',
          file: file.key,
          exportName,
          reason: `export "${exportName}" is an array whose length could not be read — ${messageOf(error)}`,
          cause: error,
        });

        continue;
      }

      for (let index = 0; index < length; index += 1) {
        let element: unknown;

        try {
          element = value[index];
        } catch (error) {
          diagnostics.push({
            severity: 'error',
            file: file.key,
            exportName: `${exportName}[${index}]`,
            reason: `export "${exportName}[${index}]" could not be read — ${messageOf(error)}`,
            cause: error,
          });

          continue;
        }

        take(element, `${exportName}[${index}]`);
      }
    } else {
      // `default` is one key of the namespace like any other.
      take(value, exportName);
    }
  }

  return { collected, created, importFailed };
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
    boundHookCount: 0,
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
    files = await collectHookFiles(scanRoot, diagnostics);
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

  // `moduleCache: false` is the whole point, not a performance knob.
  //
  // With it left at its default, jiti delegates to Node's `require.cache` — a
  // *process*-global store keyed on resolved filename — so creating the instance
  // inside the load isolated nothing, and every load after the first in one
  // process re-served stale hook modules. See {@link ScanModuleCache}. The cache
  // that makes one scan evaluate one module once is `moduleCache` below, and it
  // dies with the scan.
  //
  // `fsCache` stays on: it caches *transpiled source* keyed by file content, so
  // it cannot serve a stale module — only a stale transpile of bytes that have
  // not changed.
  const jiti = createJiti(import.meta.url, {
    alias: { [HOOKS_RUNTIME_SPECIFIER]: hooksRuntimeModule },
    moduleCache: false,
  });

  const moduleCache: ScanModuleCache = Object.create(null) as ScanModuleCache;
  const collected: CollectedRegistration[] = [];
  const createdPerFile: {
    file: string;
    created: HookRegistration[];
    importFailed: boolean;
  }[] = [];
  const exported = new Set<unknown>();

  for (const file of files) {
    const result = await importRegistrations(
      jiti,
      moduleCache,
      file,
      diagnostics,
      exported,
    );

    collected.push(...result.collected);
    createdPerFile.push({
      file: file.key,
      created: result.created,
      importFailed: result.importFailed,
    });
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

  reportUnexportedRegistrations(createdPerFile, exported, diagnostics);

  const boundHookCount = bindRegistrations(
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
    boundHookCount,
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
 *
 * The diff runs against `exported` — **every** branded value the scan found as an
 * export — not against the registrations that survived to `collected`. A branded
 * value with an unrecognised `kind`, or one whose fields could not be read, is
 * *exported*; it already drew its own precise diagnostic, and counting it as
 * missing added a second, contradictory one telling the user to export something
 * they had exported.
 *
 * A file whose import threw is skipped entirely. It has already failed the run
 * by name, and everything it managed to create before throwing is a consequence
 * of that failure rather than a second, independent mistake.
 */
function reportUnexportedRegistrations(
  createdPerFile: {
    file: string;
    created: HookRegistration[];
    importFailed: boolean;
  }[],
  exported: Set<unknown>,
  diagnostics: HookDiagnostic[],
): void {
  for (const { file, created, importFailed } of createdPerFile) {
    if (importFailed) {
      continue;
    }

    const missing = created.filter(
      (registration) => !exported.has(registration),
    );

    if (missing.length === 0) {
      continue;
    }

    diagnostics.push({
      severity: 'error',
      file,
      reason: `${missing.length} registration(s) created while loading "${file}" but not exported by any scanned hook file, so they can never run; assign them to an export (e.g. \`export const authLogin = beforeEach(…)\`)`,
      suggestions: [
        "Hooks are discovered from a scanned file's exports. A registration that is only created, that sits inside a nested array, or that is exported only from a file the scan skips (a dot-directory, or anywhere outside the hooks directory) is never loaded — re-export it from a scanned file.",
      ],
    });
  }
}

/**
 * Binds every collected registration and returns how many of them bound.
 *
 * The count is **not** `perTransaction.size`: one global `authorize` puts an
 * entry in that map for every transaction in the catalog, so a single hook in a
 * 240-transaction API reported "240 transaction hook binding(s)".
 */
function bindRegistrations(
  collected: CollectedRegistration[],
  catalog: TransactionCatalog,
  perTransaction: Map<string, TransactionHooks>,
  sampleDefinitions: Map<string, SampleCallback>,
  runScoped: LoadUserHooksResult['runScoped'],
  diagnostics: HookDiagnostic[],
): number {
  const sampleOwner = new Map<string, CollectedRegistration>();
  const targetedAuthorize = new Map<string, CollectedRegistration>();
  const targetedAuthorizeCallback = new Map<string, AuthorizeCallback>();
  let globalAuthorize: CollectedRegistration | undefined;
  let globalAuthorizeCallback: AuthorizeCallback | undefined;
  let matched = 0;
  let bound = 0;

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
        bound += 1;
        break;

      case 'afterAll':
        runScoped.afterAll.push(entry);
        bound += 1;
        break;

      case 'defineSample': {
        const ids = resolve(entry, registration.target);

        if (!ids) {
          break;
        }

        bound += 1;

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

        if (ids) {
          bound += 1;
        }

        for (const id of ids ?? []) {
          hooksFor(perTransaction, id).beforeEach.push(registration.callback);
        }

        break;
      }

      case 'afterEach': {
        const ids = resolve(entry, registration.target);

        if (ids) {
          bound += 1;
        }

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
          bound += 1;
          break;
        }

        const ids = resolve(entry, registration.target);

        if (ids) {
          bound += 1;
        }

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
  let globalAuthorizeReach = 0;

  for (const [, transaction] of catalog.entries()) {
    const targeted = targetedAuthorizeCallback.get(transaction.transactionId);
    const callback = targeted ?? globalAuthorizeCallback;

    if (!callback) {
      continue;
    }

    if (!targeted) {
      globalAuthorizeReach += 1;
    }

    hooksFor(perTransaction, transaction.transactionId).authorize = callback;
  }

  if (globalAuthorize) {
    // The global branch above returns before `resolve()`, so without this a hook
    // that is bound and will run produced **no diagnostic at all** — 575.10's
    // `validate` renders this array, and it showed nothing. Reported after the
    // precedence loop because only then is the number honest: it is the count of
    // transactions the global hook actually covers, with every targeted
    // `authorize` already subtracted.
    matched += 1;

    diagnostics.push({
      severity: 'info',
      file: globalAuthorize.file,
      kind: 'authorize',
      anchor: describeTarget(undefined),
      exportName: globalAuthorize.exportName,
      reason: `resolved to ${globalAuthorizeReach} transaction(s)`,
    });
  }

  if (matched > 0) {
    diagnostics.push({
      severity: 'info',
      file: '',
      reason: `${matched} hook target(s) resolved against ${catalog.size} transaction(s)`,
    });
  }

  return bound;
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
