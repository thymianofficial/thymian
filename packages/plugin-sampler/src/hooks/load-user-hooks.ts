import type { Dirent } from 'node:fs';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ThymianBaseError } from '@thymian/core';
import { createJiti, type Jiti, type ModuleCache } from 'jiti';

import type { TransactionCatalog } from '../selectors/transaction-catalog.js';
import { entryExists } from '../utils.js';
import {
  type AfterEachCallback,
  type AuthorizeCallback,
  type BeforeEachCallback,
  HOOK_KINDS,
  HOOK_REGISTRATION,
  type HookRegistration,
  type HookTarget,
  isHookRegistration,
  type SampleCallback,
  withCreationScope,
} from './hook-registration.js';
import {
  asFiniteNumber,
  asFunction,
  asString,
  isArrayValue,
  isNullish,
  messageOf,
  ownKeys,
  raw,
  readIndex,
  readProperties,
  readProperty,
  safeJson,
  safeString,
  suggestionsOf,
  truncateLabel,
  typeOf,
  type UserValue,
  userValue,
} from './user-value.js';

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
 * (the sort, `bindRegistrations`, every diagnostic) reads the
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
   *
   * Does **not** count `runScoped.beforeAll`/`runScoped.afterAll`: "bound" means
   * something calls it, and nothing does until 575.8 executes run-scoped hooks.
   * They were counted through round 7; the debug log then read "Loaded 1
   * hook(s)" for a `beforeAll` that could not run, which is the same silence as
   * a hook that is bound but never fires.
   */
  boundHookCount: number;
};

/**
 * Keep a file iff its name is one of the six module extensions AC 1 names —
 * `.js .mjs .cjs .ts .mts .cts` — and is not a declaration file.
 *
 * `.tsx`/`.jsx` are **not** among them: AC 1's keep pattern has no `x`, and JSX
 * needs a transform pragma the plugin's jiti instance is not configured for, so
 * a `.tsx` file would be scanned only to fail on its own syntax.
 *
 * The declaration-file exclusion is **case-insensitive** while the keep pattern
 * is not, which is deliberate rather than an oversight. `types.D.ts` matched the
 * keep pattern (it does end in `.ts`) but missed a case-sensitive `\.d\.ts$`, so
 * a hand-written declaration file was handed to jiti and its `declare module`
 * syntax drew a spurious *"could not be imported"* error that failed the whole
 * run. Exclusion is the safe direction to widen: it can only ever skip a file
 * that could not have executed. Widening the *keep* pattern the same way would
 * start scanning `HOOK.TS` on a case-insensitive filesystem and not on a
 * case-sensitive one, which is a platform-dependent scan — that is the separate
 * deferred "filename casing and separators" decision, not something to smuggle
 * in here.
 */
export function isHookFile(name: string): boolean {
  if (/\.d\.[cm]?ts$/i.test(name)) {
    return false;
  }

  return /\.[cm]?[jt]s$/.test(name);
}

type HookFile = {
  /** Hooks-dir-relative, `/`-normalized. The sort key and the diagnostic label. */
  key: string;
  /** The entry's **real** path — symlinks resolved. */
  full: string;
  /**
   * What makes this entry *the same file* as another. See {@link fileIdentity}.
   */
  identity: string;
  /**
   * Whether this spelling is the file itself rather than a link to it.
   *
   * Decides attribution when two spellings collapse to one. Plain sort order
   * handed a link named `aaa-link.ts` the attribution over the `zzz-real.ts` it
   * points at, so the diagnostic sent the user to a file containing a symlink
   * instead of to the code that broke.
   */
  isLink: boolean;
};

/**
 * The identity two directory entries share when they are one file.
 *
 * `realpath` resolves symlinks but **not hard links**: two entries naming one
 * inode keep two distinct real paths, so the round-2 realpath dedupe counted two
 * files, evaluated the module twice, and composed one authored `beforeEach`
 * twice — the `'linkedlinked'` symptom the symlink fix closed, wearing a
 * different filesystem primitive and this time with no error to make it visible
 * (`hasErrors: false`, composed path `"HH"`). A `defineSample` under the same
 * shape reports itself as its own rival.
 *
 * `dev` + `ino` is the identity the filesystem itself uses. `bigint: true` keeps
 * the inode exact — the number form loses precision above 2^53, which large
 * inodes reach in practice. Windows reports `ino: 0` on some filesystems, so the
 * real path stays the fallback and every case the round-2 fix covered still
 * dedupes there.
 *
 * Not to be confused with #711 (`node_modules`/`dist` copies), which are two
 * genuinely distinct files with distinct inodes and are deliberately left alone.
 */
export function fileIdentityFrom(
  real: string,
  info: { dev: bigint; ino: bigint; nlink: bigint } | undefined,
): string {
  // `nlink > 1` is what proves this entry *is* a hard link, and it is the whole
  // reason to prefer the inode over the path. Split out as a pure function
  // because the decision cannot otherwise be tested: no real filesystem will
  // report the same inode for two distinct files, which is precisely the case
  // that made the unconditional version dangerous.
  if (info !== undefined && info.ino !== 0n && info.nlink > 1n) {
    return `inode:${info.dev}:${info.ino}`;
  }

  return `path:${real}`;
}

async function fileIdentity(real: string): Promise<string> {
  try {
    const info = await stat(real, { bigint: true });

    // `nlink > 1` is what proves this entry *is* a hard link, and it is the
    // whole reason to prefer the inode over the path.
    //
    // Trusting `dev:ino` unconditionally was a worse bug than the one it fixed.
    // Several FUSE drivers, some SMB/CIFS servers and Docker volume drivers
    // report a constant or colliding non-zero inode; on such a mount every hook
    // file collapsed to one identity and nine hooks in ten vanished with no
    // diagnostic and `hasErrors: false`. Silent loss beats double-composition
    // for how bad it is. `nlink` makes that unreachable: a file with one link is
    // never deduped by inode, and a hard link always has at least two.
    return fileIdentityFrom(real, info);
  } catch {
    // A path we could `readdir` but not `stat`. Fall back to the path; the
    // import below reports anything genuinely unreadable.
  }

  // Tagged, so a path identity can never accidentally equal an inode one — the
  // two are different namespaces and comparing them across a failed `stat` was
  // how one of two hard links could still slip through.
  return fileIdentityFrom(real, undefined);
}

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
 * Every hook file under `hooksDir`, sorted by hooks-dir-relative path, with
 * entries that are the same file collapsed to one.
 *
 * The walk itself, and what it does and does not follow, is
 * {@link walkHookDirectory}. This function owns the two decisions layered on top
 * of it: the sort, and the dedupe.
 *
 * **Why the dedupe exists.** Following a symlink is not enough on its own: when
 * the link's target is *also* under the hooks directory, the scan sees one
 * authored file under two spellings, and `evaluateModule` keys its cache on
 * jiti's resolution of the path it is handed — which preserves the link
 * spelling. That evaluated the file twice, and two evaluations produce two
 * distinct registration objects for one authored hook, which the identity dedupe
 * in `importRegistrations` cannot see. Observable as a `beforeEach` composing
 * twice per request, and as a `defineSample` reported as its own rival ("that
 * transaction's sample is already set by …" naming the link), an error with
 * nothing the user can fix. Realpathing the scan **root** (below) fixes only the
 * symlinked-ancestor case.
 *
 * **What identity means.** Not the real path — {@link fileIdentity}, which is
 * `dev`+`ino` where the filesystem supplies one. `realpath` collapses symlinks
 * but not hard links, and a hard link reproduced the same doubling with no error
 * to make it visible.
 *
 * Which spelling survives is decided **after** the sort, not by `readdir` order:
 * the first key in sort order wins, the same tie-break the identity dedupe
 * already uses to attribute a shared module.
 */
async function collectHookFiles(
  hooksDir: string,
  diagnostics: HookDiagnostic[],
): Promise<HookFile[]> {
  const files: HookFile[] = [];

  await walkHookDirectory(hooksDir, hooksDir, true, files, diagnostics);

  // Sort by key first so the surviving spelling never depends on `readdir`
  // order, then let a real file outrank a link to it. Both halves matter: the
  // sort is what makes the choice deterministic, and the link tie-break is what
  // makes it *useful*, because a diagnostic naming a symlink sends the reader to
  // the wrong file.
  const linkRank = (file: HookFile): number => (file.isLink ? 1 : 0);

  files.sort((a, b) => linkRank(a) - linkRank(b) || compareKeys(a.key, b.key));

  const seen = new Set<string>();
  const kept = files.filter((file) => {
    if (seen.has(file.identity)) {
      return false;
    }

    seen.add(file.identity);

    return true;
  });

  // AC 2 is about load order, and load order is by key alone — the link
  // tie-break above exists only to decide *which spelling survives*, so it must
  // not leak into the order the survivors are evaluated in.
  kept.sort((a, b) => compareKeys(a.key, b.key));

  return kept;
}

/**
 * One directory level, then its subdirectories.
 *
 * **Why not `readdir({recursive: true})`.** It is a single call, so an `EACCES`
 * on any nested directory rejects the *whole* walk: a hooks tree with one
 * root-owned subdirectory — an ordinary container image — reported
 * `fileCount: 0`, `boundHookCount: 0` and one diagnostic naming the **root**
 * hooks directory as the thing that could not be read, while the interpolated
 * cause named the subdirectory. Every healthy hook in the tree was lost, which
 * is AC 6's *"one broken file must not hide the other nine"* at directory
 * granularity. Walking a level at a time costs one `readdir` per directory and
 * confines the failure to the subtree that actually failed.
 *
 * The **root** still throws: a hooks directory that cannot be read at all is not
 * a partial result, and `loadUserHooks` turns it into the single diagnostic that
 * says the scan could not start.
 *
 * **Symlinked directories are still not followed.** `readdir({withFileTypes})`
 * reports `lstat` semantics, so a symlink to a directory answers
 * `isSymbolicLink()` and never `isDirectory()` — the descent below sees only
 * real directories, exactly as `recursive: true` did. Accepted, not worked
 * around.
 *
 * **Symlinked files are followed.** By the same `lstat` semantics a symlink
 * never answers `isFile()`, so a monorepo that symlinks a shared hook file into
 * `.thymian/sampler/hooks/` would otherwise have that hook silently dropped
 * before `isHookFile` ever ran: no diagnostic, and not even counted in
 * `fileCount`. One `stat` per symlink (not per entry) resolves the target; a
 * symlink that cannot be resolved is a diagnostic rather than a silent skip,
 * because a dangling link named `auth.ts` is exactly the case where "nothing
 * happened" is the wrong answer.
 */
async function walkHookDirectory(
  hooksDir: string,
  dir: string,
  isRoot: boolean,
  files: HookFile[],
  diagnostics: HookDiagnostic[],
): Promise<void> {
  let entries: Dirent[];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isRoot) {
      throw error;
    }

    diagnostics.push({
      severity: 'error',
      file: hooksDirRelative(hooksDir, dir),
      reason: `this directory could not be read — ${messageOf(error)}; any hooks inside it were not loaded`,
      suggestions: [
        'Fix the permissions on that directory, or move the hooks out of it.',
      ],
      cause: error,
    });

    return;
  }

  for (const dirent of entries) {
    const full = join(dir, dirent.name);

    if (dirent.isDirectory()) {
      // Dot-*subdirectories* only. Spec §2 excludes dot-directories, so
      // `hooks/.hidden/a.ts` is skipped while `hooks/.eslintrc.ts` is kept — the
      // filename itself is not subject to the rule. Deciding it at descent is
      // the same rule the hooks-dir-relative path check expressed, and it keeps
      // the property that mattered: a dot-segment in an *ancestor* of the hooks
      // directory (a checkout under `.worktrees/`, a repo under `.config/`) is
      // never even looked at, so it can never exclude anything.
      if (!dirent.name.startsWith('.')) {
        await walkHookDirectory(hooksDir, full, false, files, diagnostics);
      }

      continue;
    }

    const isLink = dirent.isSymbolicLink();

    if ((!dirent.isFile() && !isLink) || !isHookFile(dirent.name)) {
      continue;
    }

    const key = hooksDirRelative(hooksDir, full);

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
        // The branch above treats a *dangling* link as "nothing happened is the
        // wrong answer"; a link named `auth.ts` pointing at a directory deserves
        // the same, and used to get silence — no diagnostic, not even counted in
        // `fileCount`.
        diagnostics.push({
          severity: 'error',
          file: key,
          reason: target.isDirectory()
            ? 'is a symbolic link to a directory, not to a hook file'
            : 'is a symbolic link to something that is not a regular file',
          suggestions: [
            'Point the link at a hook file, or remove it from the hooks directory.',
          ],
        });

        continue;
      }
    }

    let real = full;

    try {
      real = await realpath(full);
    } catch {
      // A path we could `readdir` but not `realpath`. Keep the spelling as read;
      // the import below reports anything genuinely unreadable.
    }

    files.push({
      key,
      full: real,
      identity: await fileIdentity(real),
      isLink,
    });
  }
}

/**
 * Removes `readonly Selector[]` from the `HookTarget` union once
 * {@link isArrayValue} has answered, so the filter branch cannot still see it.
 *
 * Split in two on purpose. The *answer* can throw — `Array.isArray` on a revoked
 * Proxy — and the caller has to report that with the user's own error in it, not
 * fall through to a branch that answers a different question. The *narrowing*
 * cannot fail, so it takes the answer rather than recomputing it: calling
 * `Array.isArray` a second time would run the user's traps twice, and a hostile
 * Proxy is free to answer differently the second time.
 *
 * Named `assume`, not `is`, because that is what it does: it **asserts** a type
 * about its first argument from its second, and nothing in the signature ties
 * the two together. The caller owns that correspondence — pass the
 * `isArrayValue` answer for *this* target and no other. There is exactly one
 * call site, immediately below the `isArrayValue` that produced the boolean.
 */
function assumeSelectorList(
  target: HookTarget,
  isArray: boolean,
): target is readonly string[] {
  void target;

  return isArray;
}

/**
 * How many elements of a user-supplied list the loader will touch.
 *
 * Not a style choice — a bound. Every loop over a user list reads `length` and
 * then iterates it, and `length` is whatever the user's value reports. No Proxy
 * is needed to reach the bad case: a plain `const list = []; list.length = 2e5;`
 * produced a 2.6 MB anchor and a 12.8 MB reason, 15.4 MB in one error message,
 * in 450 ms; `1e7` exhausted memory — inside a function contracted never to
 * throw for user error. `Array.from({ length: n })` or an off-by-one index write
 * reaches it by accident.
 *
 * A hook targets selectors a human wrote, so a list this long is already a
 * mistake. The cap is reported, never silent: the diagnostic says how many there
 * were.
 */
const MAX_USER_LIST_ELEMENTS = 100;

/**
 * How many per-element failures one diagnostic will quote before summarising.
 *
 * The same bound in the other direction: without it, a 200 000-element list of
 * bad selectors joined 200 000 failure strings into one `reason`.
 */
const MAX_QUOTED_FAILURES = 10;

/**
 * The `length` of a user-controlled array-like, or `undefined` when it could not
 * be read or is not a finite number.
 *
 * `Array.isArray` is `true` for a Proxy whose target is an array, so `length` is
 * a `get` trap like any other and a hostile one can throw or answer a value that
 * is not a number at all.
 */
function readLength(value: UserValue): number | undefined {
  const read = readProperty(value, 'length');

  if (!read.ok) {
    return undefined;
  }

  const length = asFiniteNumber(read.value);

  return length === undefined ? undefined : clampLength(length);
}

/**
 * A reported `length` as an element count.
 *
 * A negative or fractional value is not one. Left as read, it slipped past the
 * `=== 0` empty-list guard: a list reporting `-1` bound nothing, reported
 * `boundHookCount: 1` and `hasErrors: false`, and the hook silently never fired;
 * `0.5` produced "1 of 0.5 selector(s) do not resolve". One function, because
 * three hand-inlined copies of an invariant is how the `=== 0` guard drifted
 * from the clamp in the first place.
 */
function clampLength(length: number | undefined): number {
  return Math.max(0, Math.trunc(length ?? 0));
}

/**
 * The target as authored, rendered for a diagnostic — for **any** value.
 *
 * {@link renderTarget} is **total**: every operation it performs on the target
 * goes through `user-value.ts`, which is enforced by the opaque {@link UserValue}
 * type and by the lint ban in `eslint.config.mjs`. This wrapper is therefore a
 * backstop, not the mechanism — kept because `describeTarget` runs *before*
 * `resolveTargeting`, precisely to label the diagnostic that reports a failure,
 * and a renderer that can throw cannot do that job.
 *
 * Consequence worth stating: neutralising *this* `catch` no longer breaks a
 * test, because there is nothing left for it to catch. The mutation that
 * discriminates now lives one level down, in the guards inside
 * {@link renderTarget} and in `user-value.ts`.
 */
export function describeTarget(target: HookTarget | undefined): string {
  try {
    return renderTarget(target);
  } catch {
    return '[unprintable target]';
  }
}

function renderTarget(target: HookTarget | undefined): string {
  if (target === undefined) {
    return 'global';
  }

  const value = userValue(target);
  const literal = asString(value);

  if (literal !== undefined) {
    // A primitive string has no traps left to run, but it can be enormous: one
    // five-million-character selector produced a ten-megabyte error message.
    // `safeString` is where the length bound lives, and a primitive passes
    // through it unchanged apart from that bound.
    return `"${safeString(literal)}"`;
  }

  const array = isArrayValue(value);

  if (!array.ok) {
    // `Array.isArray` threw, so not even the *shape* of this target is known —
    // a revoked Proxy. The generic label is the honest one here; the two
    // specific labels below both claim knowledge this branch does not have.
    return '[unprintable target]';
  }

  if (array.value) {
    // `target` is user data even when it is an array: `Array.isArray` is `true`
    // for a Proxy whose target is an array, so `length` and every element read
    // run the user's `get` trap, and rendering an element invokes a
    // `Symbol.toPrimitive` the user wrote.
    const length = readLength(value);

    if (length === undefined) {
      return '[unprintable selector list]';
    }

    const shown = Math.min(length, MAX_USER_LIST_ELEMENTS);
    const rendered: string[] = [];

    for (let index = 0; index < shown; index += 1) {
      const element = readIndex(value, index);

      if (!element.ok) {
        return '[unprintable selector list]';
      }

      rendered.push(`"${safeString(raw(element.value))}"`);
    }

    if (shown < length) {
      // Reported, not silently truncated: the count is the thing that tells the
      // user their list is not the list they thought they wrote.
      rendered.push(`… ${length - shown} more`);
    }

    return `[${rendered.join(', ')}]`;
  }

  if (typeOf(value) !== 'object' || isNullish(value)) {
    // A primitive in the target slot — `null`, a number, a boolean, a `Symbol`,
    // a `BigInt`, a function. `JSON.stringify` throws outright on a `BigInt` and
    // answers `undefined` for a function, so it is the wrong renderer for any of
    // them, and falling into the filter label below would call a number a
    // filter. `safeString` is total and says what the value actually is.
    return safeString(raw(value));
  }

  const json = safeJson(value);

  if (!json.ok) {
    // An object that will not stringify: a filter is user data and may be
    // circular or carry a throwing accessor.
    return '[unprintable filter]';
  }

  // `JSON.stringify` answers `undefined` for a value it cannot represent — not a
  // failure, so the string form is still worth a try before giving up.
  return json.value ?? safeString(raw(value));
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
 *
 * The parameter is a {@link UserValue}, not a `TransactionFilter`, on purpose.
 * Typed as the latter, the natural implementation — `filter.method`,
 * `'tag' in filter`, `Object.entries(filter)` — type-checks against a value that
 * is still whatever the user's hook file put in the target slot, and `in` runs a
 * `has` trap that nothing bans. Making the seam opaque means 575.4 reaches its
 * fields through `user-value.ts` from the first line it writes, rather than
 * rediscovering this class a fifth time.
 */
function matchTransactionFilter(
  filter: UserValue,
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
  try {
    return resolveTargetingUnguarded(target, catalog);
  } catch (error) {
    // The target is user data all the way down, and this function is where it
    // is finally *used*: `Array.isArray`, `selectors.length` and the `for…of`
    // iteration each run the user's `get` trap, and `Array.isArray` throws
    // outright on a revoked Proxy. The 575.4 filter seam below can raise
    // anything at all. Each of those escaped `loadUserHooks` as an unformatted
    // error with no `file:` attribution and destroyed the whole scan, so the
    // healthy files never bound — the exact opposite of AC 6.
    //
    // The inner `try`s stay: they report *which selector* failed, which this
    // one cannot know.
    return {
      ok: false,
      error: `could not be resolved — ${messageOf(error)}`,
      suggestions: suggestionsOf(error) ?? [
        'Target a hook with a selector string, a list of selector strings, or a transaction filter.',
      ],
    };
  }
}

function resolveTargetingUnguarded(
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

  const value = userValue(target);
  const array = isArrayValue(value);

  if (!array.ok) {
    // `Array.isArray` threw before the shape was even known — a revoked Proxy.
    // Reported here rather than left to the outer guard so the message says
    // which *operation* failed and carries the user's own error, instead of
    // falling through to the filter branch and answering the unrelated
    // "matched none of the N loaded transaction(s)".
    return {
      ok: false,
      error: `could not be inspected — ${messageOf(array.error)}`,
      suggestions: suggestionsOf(array.error) ?? [
        'Target a hook with a selector string, a list of selector strings, or a transaction filter.',
      ],
    };
  }

  if (assumeSelectorList(target, array.value)) {
    const selectors = value;
    const lengthRead = readProperty(selectors, 'length');

    if (!lengthRead.ok) {
      return {
        ok: false,
        error: `targets a selector list whose length could not be read — ${messageOf(lengthRead.error)}`,
        suggestions: suggestionsOf(lengthRead.error) ?? [
          'Export the selector list as an ordinary array, not a proxy around one.',
        ],
      };
    }

    // A `length` that is not a finite number — or is negative or fractional —
    // names no selectors at all, which the empty-list branch below already has
    // the right words for. See {@link readLength} for why the clamp matters.
    const length = clampLength(asFiniteNumber(lengthRead.value));

    if (length === 0) {
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
    let failureCount = 0;
    let suggestions: string[] | undefined;
    // Bounded: see {@link MAX_USER_LIST_ELEMENTS}. A list longer than this is
    // already not a list of selectors a human wrote, and the diagnostic says so
    // rather than trying to resolve every entry.
    const examined = Math.min(length, MAX_USER_LIST_ELEMENTS);

    for (let index = 0; index < examined; index += 1) {
      const element = readIndex(selectors, index);

      if (!element.ok) {
        // The element could not be read at all — a `get` trap that throws. There
        // is no value to name, so the index is the only honest label.
        failureCount += 1;

        if (failures.length < MAX_QUOTED_FAILURES) {
          failures.push(`[${index}] — ${messageOf(element.error)}`);
        }

        suggestions ??= suggestionsOf(element.error);
        continue;
      }

      try {
        // `resolve` declares `string` and coerces what it is given; the coercion
        // runs the user's `Symbol.toPrimitive`, which is why the call is inside
        // the `try` rather than beside it.
        ids.push(catalog.resolve(raw(element.value) as string).transactionId);
      } catch (error) {
        // `safeString`, not interpolation: a selector list is user data, and an
        // element with a throwing `Symbol.toPrimitive` reaches here *because*
        // `catalog.resolve` coerced it and the coercion threw. Interpolating it
        // into the failure message threw the same error a second time, straight
        // out of the catch block that exists to report it.
        failureCount += 1;

        if (failures.length < MAX_QUOTED_FAILURES) {
          failures.push(
            `"${safeString(raw(element.value))}" — ${messageOf(error)}`,
          );
        }

        suggestions ??= suggestionsOf(error);
      }
    }

    if (failureCount > 0) {
      const quoted =
        failureCount > failures.length
          ? `${failures.join('; ')}; … and ${failureCount - failures.length} more`
          : failures.join('; ');

      // `examined`, not `length`, when they differ: claiming to have checked 200
      // when 100 were checked hides every bad selector past the cap.
      const scope =
        examined < length
          ? `${length} selector(s), of which only the first ${examined} were checked,`
          : `${length} selector(s)`;

      return {
        ok: false,
        error: `${failureCount} of ${scope} do not resolve: ${quoted}`,
        suggestions,
      };
    }

    if (examined < length) {
      // Every selector examined resolved, but the list is longer than the
      // loader will touch. Binding the prefix and staying silent would be the
      // worst answer: the user would get some of their hooks and no reason for
      // the rest.
      return {
        ok: false,
        error: `targets a list of ${length} selectors, more than the ${MAX_USER_LIST_ELEMENTS} a hook target may name`,
        suggestions: [
          'Name the transactions a hook needs explicitly, or use a transaction filter instead of a generated list.',
        ],
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

  // Everything that is left must be a filter, and `TransactionFilter` is a
  // non-array **object**. A primitive in the target slot has no branch at all,
  // so it used to fall through to the matcher and come back "matched none of the
  // N loaded transaction(s)" — true, and silent about the actual mistake.
  if (typeOf(value) !== 'object' || isNullish(value)) {
    return {
      ok: false,
      error: `targets a ${typeOf(value)}, which is not a selector, a selector list or a transaction filter`,
      suggestions: [
        'Target a hook with a selector string, a list of selector strings, or a transaction filter object.',
      ],
    };
  }

  const matched = matchTransactionFilter(value, catalog);

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
  reported: Set<string>,
): Promise<unknown> {
  let resolved = full;

  try {
    // `esmResolve` returns a `file://` URL; the cache is keyed on the plain path.
    resolved = fileURLToPath(jiti.esmResolve(full));
  } catch {
    // Unresolvable: fall through and let the read below produce the diagnostic.
  }

  const cached: { exports: unknown; loaded: boolean } | undefined =
    moduleCache[resolved];

  if (cached) {
    if (!cached.loaded) {
      // Reported here, so the end-of-scan sweep does not say it twice.
      reported.add(resolved);

      // The entry exists but the module never finished.
      //
      // jiti 2.6.1's `evalModule` writes `cache[filename] = module` **before**
      // running the body and sets `module.loaded = true` only on success, so a
      // module that throws mid-body leaves a cache entry holding whatever
      // exports it managed to assign first. The round-2 note that "a module that
      // throws leaves no cache entry" is false — measured directly against jiti,
      // the key is present after the throw.
      //
      // Serving it was the worst of both worlds. With `a.ts` = `import
      // './b.js';`, `b.ts` was reported *healthy* and its hook bound while the
      // importer took the blame; flip the sort order and the attribution flips
      // with it. The silent form is worse still: with
      // `a.ts` = `try { await import('./b.js') } catch {}` the scan reported
      // `hasErrors: false` and the hook from the module that threw actually ran.
      //
      // Re-evaluating is not the answer — the body already ran once and its
      // side effects already happened. The honest answer is that this file
      // failed to import, which is what AC 6 says a throwing file is.
      throw new ThymianBaseError(
        'it threw while being imported earlier in this scan, so only the exports it managed to create before throwing exist',
        {
          name: 'HookModuleNotLoaded',
          suggestions: [
            'Fix the error this file throws at import time; a hook file that imports it may be swallowing it with try/catch.',
          ],
        },
      );
    }

    // Already evaluated in this scan, as some earlier file's dependency. Its
    // exports are the same objects that file saw, so the identity dedupe in
    // `take` collapses the two sightings into one registration — which is what
    // keeps a shared hook module from becoming a cross-file conflict.
    return cached.exports;
  }

  try {
    return await jiti.evalModule(await readFile(resolved, 'utf-8'), {
      filename: resolved,
      ext: extname(resolved),
      cache: moduleCache,
      async: true,
    });
  } catch (error) {
    // The caller turns this into that file's own `could not be imported`
    // diagnostic, so the end-of-scan sweep must not name it a second time —
    // a module that throws is exactly the state the sweep looks for, and jiti
    // has already written the `loaded: false` entry by the time we get here.
    reported.add(resolved);

    throw error;
  }
}

/** The four field names a registration carries, in read order. */
const REGISTRATION_FIELDS = ['kind', 'order', 'target', 'callback'] as const;

/**
 * Every field of a registration, read once, behind one guard.
 *
 * They stay {@link UserValue}: reading them proved only that the `get` traps did
 * not throw, not that what came back is a string, a number or a function.
 */
type RegistrationFields = Record<
  (typeof REGISTRATION_FIELDS)[number],
  UserValue
>;

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
  const order = asFiniteNumber(fields.order) ?? Number.MAX_SAFE_INTEGER;

  // Built whole rather than spread: object spread reads own enumerable
  // properties, which on a user value runs its `ownKeys` and `get` traps — the
  // one shape the `UserValue` type still lets through, so this file bans it
  // (see eslint.config.mjs). `fields` is already read and guarded, but writing
  // it this way keeps the ban free of exceptions.
  const registration =
    kind === 'beforeAll' || kind === 'afterAll'
      ? {
          kind,
          order,
          callback: raw(fields.callback),
          [HOOK_REGISTRATION]: true,
        }
      : {
          kind,
          order,
          target: raw(fields.target),
          callback: raw(fields.callback),
          [HOOK_REGISTRATION]: true,
        };

  return Object.freeze(registration) as HookRegistration;
}

/**
 * Imports one hook file and collects every export that is a registration.
 *
 * **Nothing here reads a user value without a guard, and that is now checked
 * rather than asserted.** The namespace, each export name, each export value,
 * each element of an exported array and each field of a branded object are all
 * user-controlled: a CJS re-export can carry an enumerable throwing getter, an
 * export can be a Proxy that throws on `ownKeys` or on any property read, a
 * branded value can be a Proxy whose `kind` or `callback` accessor throws, and a
 * revoked Proxy makes even `Array.isArray` throw. Every one of those used to
 * throw straight out of `loadUserHooks` → `HookRunner.init` → `core.format` as
 * an unformatted error with no `file:` attribution, breaking this module's two
 * stated contracts: "never throws for user error" and "one broken file must not
 * hide the other nine".
 *
 * Three rounds asserted this sentence and three rounds found another instance —
 * so it is no longer an assertion. Every value below is a {@link UserValue},
 * which has no readable members, and every read goes through `user-value.ts`;
 * see that module's header for the two mechanisms (a type error, then a lint
 * error) and for why neither closes the class alone. `isHookRegistration`
 * already tolerates a throwing property access (`hook-registration.ts:239-243`).
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
  reportedModules: Set<string>,
): Promise<{
  collected: CollectedRegistration[];
  created: HookRegistration[];
  exportsUnusable: boolean;
}> {
  const collected: CollectedRegistration[] = [];

  let mod: unknown;
  let exportsUnusable = false;

  // No `{ default: true }`: that option (v1's `tryImport`) collapses the
  // namespace to the default export and would discard every named registration.
  // `interopDefault` stays on, which is what makes a CJS hook file's
  // `module.exports` appear as namespace keys.
  const evaluated = await withCreationScope(
    async () =>
      await evaluateModule(jiti, moduleCache, file.full, reportedModules),
  );
  const created = evaluated.created;

  if (evaluated.error !== undefined) {
    // One broken file must not hide the other nine.
    exportsUnusable = true;

    diagnostics.push({
      severity: 'error',
      file: file.key,
      reason: `could not be imported — ${messageOf(evaluated.error)}`,
      cause: evaluated.error,
    });
  } else {
    mod = evaluated.result;
  }

  const take = (value: UserValue, exportName: string): void => {
    const candidate = raw(value);

    if (!isHookRegistration(candidate) || exported.has(candidate)) {
      return;
    }

    exported.add(candidate);

    // Read the discriminant raw: `isHookRegistration` only proves the brand, so
    // the narrowed type is a claim about `kind` that a version-skewed runtime
    // can falsify. Dropping such a value silently would turn a plugin/hooks
    // mismatch into hooks that simply never fire.
    const read = readProperties(value, REGISTRATION_FIELDS);

    if (!read.ok) {
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        reason: `carries the hook-registration brand but its fields could not be read — ${messageOf(read.error)}`,
        suggestions: [
          'Export the value the @thymian/hooks runtime returned, not a wrapper or a proxy around it.',
        ],
        cause: read.error,
      });

      return;
    }

    const fields = read.value;
    const kind = asString(fields.kind);

    if (kind === undefined || !HOOK_KINDS.has(kind)) {
      const rendered = safeString(raw(fields.kind));

      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        kind: kind ?? rendered,
        reason: `is a hook registration of an unrecognised kind "${rendered}"`,
        suggestions: [
          'Check that @thymian/plugin-sampler and the @thymian/hooks runtime your hook resolved are the same version.',
        ],
      });

      return;
    }

    if (asFunction(fields.callback) === undefined) {
      // Reached only by a hand-rolled or skewed branded value: the runtime's own
      // factories reject a non-callable callback. Binding it anyway would defer
      // the failure to the first request, long after the load-time report.
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        kind,
        reason: `is a ${kind} hook registration whose callback is not a function`,
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

  const namespace = userValue(mod);
  const keys = ownKeys(namespace);

  if (!keys.ok) {
    // The exports cannot be enumerated, so nothing about this file's export
    // surface is knowable. Marking it unusable is what stops
    // `reportUnexportedRegistrations` adding a second, contradictory diagnostic
    // telling the user to export a registration they may well have exported —
    // the same interlock the `evaluateModule` catch already had.
    exportsUnusable = true;

    diagnostics.push({
      severity: 'error',
      file: file.key,
      reason: `exports could not be enumerated — ${messageOf(keys.error)}`,
      cause: keys.error,
    });
  }

  for (const exportName of keys.ok ? keys.value : []) {
    const read = readProperty(namespace, exportName);

    if (!read.ok) {
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        reason: `could not be read — ${messageOf(read.error)}`,
        cause: read.error,
      });

      continue;
    }

    const value = read.value;
    const array = isArrayValue(value);

    if (!array.ok) {
      // `Array.isArray` **throws** on a revoked Proxy rather than answering
      // `false`. It sat outside every guard here — the last unguarded
      // user-value read on the collection path — and took the whole scan with
      // it: no result, no diagnostic, no `file:` attribution, and both healthy
      // siblings lost.
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        reason: `could not be inspected — ${messageOf(array.error)}`,
        suggestions: [
          'Export the value the @thymian/hooks runtime returned, not a revoked or hostile proxy around it.',
        ],
        cause: array.error,
      });

      continue;
    }

    if (!array.value) {
      // `default` is one key of the namespace like any other.
      take(value, exportName);
      continue;
    }

    // One level, element-wise, no deep flattening. A *nested* array is not
    // discovered; it surfaces through the created-but-not-exported diagnostic
    // instead, which is the intended interlock rather than a gap.
    //
    // Indexed rather than `forEach`, and each read guarded: `Array.isArray` is
    // true for a Proxy whose target is an array, and both `length` and every
    // element read then run the user's `get` trap.
    const lengthRead = readProperty(value, 'length');

    if (!lengthRead.ok) {
      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        reason: `is an array whose length could not be read — ${messageOf(lengthRead.error)}`,
        cause: lengthRead.error,
      });

      continue;
    }

    // A `length` that is not a finite number — or is negative or fractional —
    // yields no elements, which is what the old `index < length` comparison did
    // for `NaN` and for a non-number alike, made explicit rather than left to
    // comparison semantics.
    const length = clampLength(asFiniteNumber(lengthRead.value));
    const examined = Math.min(length, MAX_USER_LIST_ELEMENTS);

    if (examined < length) {
      // Marked unusable for the same reason the enumeration failure is: the
      // scan refused to read this export, so it cannot then turn round and tell
      // the user they failed to export what is in it. Without this the file drew
      // both "is an array of 101 values" and "101 registration(s) … not
      // exported", which is the contradictory pair the enumeration branch
      // already exists to avoid.
      exportsUnusable = true;

      diagnostics.push({
        severity: 'error',
        file: file.key,
        exportName,
        reason: `is an array of ${length} values, more than the ${MAX_USER_LIST_ELEMENTS} an exported hook list may hold`,
        suggestions: [
          'Export the hooks a file defines individually, or in a list short enough to read.',
        ],
      });

      continue;
    }

    for (let index = 0; index < examined; index += 1) {
      const element = readIndex(value, index);

      if (!element.ok) {
        diagnostics.push({
          severity: 'error',
          file: file.key,
          exportName: `${exportName}[${index}]`,
          reason: `could not be read — ${messageOf(element.error)}`,
          cause: element.error,
        });

        continue;
      }

      take(element.value, `${exportName}[${index}]`);
    }
  }

  return { collected, created, exportsUnusable };
}

/**
 * Every module in this scan that started evaluating and never finished, other
 * than the ones already reported by name.
 *
 * **Why a sweep and not just the cache-hit refusal.** {@link evaluateModule}
 * refuses a `loaded: false` entry, but it only ever sees a module the *scan*
 * asks for. jiti's own nested resolution has no such check — measured in
 * jiti 2.6.1, a nested hit is `if (cache[id]) return interopDefault(cache[id]
 * .exports)` with nothing about `loaded` — so a module that is **not** itself a
 * hook file (under a dot-directory, in a sibling `lib/`, or anywhere outside the
 * hooks directory) never reaches the refusal at all. Reproduced: `a.ts` doing
 * `try { await import('./.internal/broken.js') } catch {}` came back
 * `hasErrors: false` with the hook from the module that threw **bound and
 * running**. That is the exact case the refusal's docblock claimed to have
 * closed, one level out.
 *
 * Reporting the **module** rather than its importers is also what makes the
 * verdict independent of scan order. Attributing to importers reported the same
 * tree differently depending on whether the importer sorted before or after the
 * broken file — same input, opposite outcome, decided by a filename.
 *
 * The cache is user-derived data (jiti fills it from the user's own import
 * graph), so it is read through `user-value.ts` like everything else here.
 */
/**
 * Every value an **unfinished** module in the scan's cache exposes as an export.
 *
 * (This block sits above `valuesExportedByUnfinishedModules`; the sweep's own
 * "why a sweep and not just the cache-hit refusal" docblock is on
 * {@link unfinishedModules} below.)
 *
 * The created-but-not-exported diff asks "did the user assign this registration
 * to an export?", and `exported` — which only holds what a *scanned* file
 * exposed — answers a narrower question. A registration exported from a module
 * that failed to load, or from one the scan never visits, is in nobody's
 * `exported` set and yet the user did exactly what the diagnostic asks of them.
 *
 * Both attempts to fix that by *file* were wrong in opposite directions.
 * Skipping only the offending file blamed the importer for a registration the
 * broken module really did export — the creation lands in the importer's
 * evaluation window, and that window belongs to a file whose own import
 * succeeded. Bailing for the whole scan hid a genuine missing export in a
 * healthy file behind an unrelated sibling's import failure, which is AC 6's
 * sentence pointed the other way.
 *
 * The question is about a *registration*, so it is answered per registration.
 */
function valuesExportedByUnfinishedModules(
  moduleCache: ScanModuleCache,
): Set<unknown> {
  const seen = new Set<unknown>();
  const cache = userValue(moduleCache);
  const keys = ownKeys(cache);

  if (!keys.ok) {
    return seen;
  }

  for (const key of keys.value) {
    const entry = readProperty(cache, key);

    if (!entry.ok) {
      continue;
    }

    const loaded = readProperty(entry.value, 'loaded');

    // **Unfinished only.** Excusing every module's exports was measurably too
    // wide: a hook exported from a healthy module the scan skips — a
    // dot-directory, a sibling `lib/` — is a registration that never binds, and
    // suppressing its diagnostic left the user a hook that silently never fires
    // and no errors at all. That is the failure this whole loader exists to
    // refuse. A module that never *finished* is the only one whose exports the
    // user cannot be blamed for.
    if (!loaded.ok || raw(loaded.value) !== false) {
      continue;
    }

    const exports = readProperty(entry.value, 'exports');

    if (!exports.ok) {
      continue;
    }

    const names = ownKeys(exports.value);

    if (!names.ok) {
      continue;
    }

    for (const name of names.value) {
      const value = readProperty(exports.value, name);

      if (value.ok) {
        seen.add(raw(value.value));
      }
    }
  }

  return seen;
}

function unfinishedModules(
  moduleCache: ScanModuleCache,
  reported: Set<string>,
  reachable: Set<unknown>,
): string[] {
  const cache = userValue(moduleCache);
  const keys = ownKeys(cache);

  if (!keys.ok) {
    return [];
  }

  const unfinished: string[] = [];

  for (const key of keys.value) {
    if (reported.has(key)) {
      continue;
    }

    const entry = readProperty(cache, key);

    if (!entry.ok) {
      continue;
    }

    const loaded = readProperty(entry.value, 'loaded');

    if (!loaded.ok || raw(loaded.value) !== false) {
      continue;
    }

    if (!contributedAnExport(entry.value, reachable)) {
      // Unfinished but harmless. See the docblock: `loaded: false` alone cannot
      // tell a throw from a module that is simply still loading.
      continue;
    }

    reported.add(key);
    unfinished.push(key);
  }

  return unfinished;
}

/**
 * Did this unfinished module's partial exports actually reach a scanned file?
 *
 * This is the whole difference between the defect and a false alarm, and
 * `loaded` cannot express it. jiti sets `loaded` to `true` only after a module
 * body completes, so an **in-flight** module is indistinguishable from one that
 * threw — and a non-awaited `import()` of a module with a slow top-level await
 * is an ordinary prefetch. Reporting on `loaded` alone failed a healthy hooks
 * tree with a sentence in which every clause was false ("threw", "swallowed the
 * error"), and did it *timing-dependently*: the same tree passed when the module
 * happened to finish first.
 *
 * What actually characterises the defect is narrower and is observable: the
 * unfinished module exposes a registration **this scan created**, so a hook is
 * about to bind from a module whose evaluation never completed. A prefetch
 * exposes nothing the scan created, which keeps the false alarm closed.
 *
 * Matching only what a *scanned file exported* was too narrow, and was measured
 * so: with `a.ts` swallowing the import and nothing re-exporting, the scan came
 * back `hasErrors: false` with zero diagnostics. One route is still open — a
 * module that hands its registration over through `globalThis` instead of
 * exporting it — because the creation log records an import *window*, not a
 * module, so a creation cannot be attributed back to the file that made it.
 * Recorded rather than papered over.
 */
function contributedAnExport(
  entry: UserValue,
  exported: Set<unknown>,
): boolean {
  const exports = readProperty(entry, 'exports');

  if (!exports.ok) {
    return false;
  }

  const keys = ownKeys(exports.value);

  if (!keys.ok) {
    return false;
  }

  for (const key of keys.value) {
    const value = readProperty(exports.value, key);

    if (value.ok && exported.has(raw(value.value))) {
      return true;
    }
  }

  return false;
}

function conflict(
  kindLabel: string,
  first: CollectedRegistration,
  second: CollectedRegistration,
  what: string,
  anchor: string,
): HookDiagnostic {
  return {
    severity: 'error',
    file: second.file,
    kind: kindLabel,
    anchor,
    exportName: second.exportName,
    reason: `${what} is already set by "${first.exportName}" in "${first.file}"`,
    suggestions: [
      'Keep one of the two hooks, or narrow their targets so they do not overlap.',
    ],
  };
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
  return await scanUserHooks(hooksDir, catalog);
}

async function scanUserHooks(
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
  //
  // WHAT THIS DOES NOT REACH (deferred #726). `moduleCache: false` governs the
  // modules jiti **transpiles**. jiti 2.6.1 decides per module with
  //
  //   forceTranspile ?? (!isCjsExt && !(isEsm && async) &&
  //                      (isTs || isEsm || isTransformRe || hasESMSyntax(src)))
  //
  // and `evaluateModule` passes `async: true`, so `.cjs` (`isCjsExt`), `.mjs`
  // and every `.js` in a `"type": "module"` package (`isEsm`) are handed to
  // Node's own loader **whatever their syntax** — and an async native load is a
  // dynamic `import()`, so they live in Node's **ESM registry**, which has no
  // eviction API at all. `require.cache` is genuinely clean here (measured), but
  // it is not where these modules are.
  //
  // Two corrections to what this story used to record. The residue is NOT just
  // "a `.cjs`, or a `.js` with no ESM syntax": that is one member of a wider set,
  // and a `.js` *with* ESM syntax in a CJS package is on the fresh side. And such
  // a module is NOT harmless because it "cannot resolve `@thymian/hooks`": it
  // does not have to *declare* a hook to *determine* one. A `sel.mjs` exporting
  // the selector a `.ts` hook targets is stale across loads in one process, so an
  // edited hook silently keeps its old binding.
  //
  // What IS closed is the half that matters most: a native load that throws falls
  // back to transpiling, and the bare `@thymian/hooks` specifier resolves only
  // through the jiti alias below — Node's loader cannot see it. So any file that
  // *creates* a registration always transpiles and is always fresh. The boundary
  // is pinned by `test/load-user-hooks.test.ts`'s "transpile/native boundary"
  // suite; `async: false` would move `.mjs` across it but breaks top-level await
  // and still leaves `.cjs` behind, which is why #726 is deferred rather than
  // patched here.
  const jiti = createJiti(import.meta.url, {
    alias: { [HOOKS_RUNTIME_SPECIFIER]: hooksRuntimeModule },
    moduleCache: false,
  });

  const moduleCache: ScanModuleCache = Object.create(null) as ScanModuleCache;
  const collected: CollectedRegistration[] = [];
  const createdPerFile: {
    file: string;
    created: HookRegistration[];
    exportsUnusable: boolean;
  }[] = [];
  const exported = new Set<unknown>();

  // Modules already named in a diagnostic, so the end-of-scan sweep does not
  // name them a second time.
  const reportedModules = new Set<string>();

  for (const file of files) {
    const result = await importRegistrations(
      jiti,
      moduleCache,
      file,
      diagnostics,
      exported,
      reportedModules,
    );

    collected.push(...result.collected);
    createdPerFile.push({
      file: file.key,
      created: result.created,
      exportsUnusable: result.exportsUnusable,
    });
  }

  // A module anywhere in the scan's import graph that started and never
  // finished. See {@link unfinishedModules} for why this is a sweep over the
  // cache rather than a per-importer check.
  // Not just what a scanned file exported: a registration this scan **created**
  // is equally about to bind, and requiring a scanned re-export missed the case
  // where `a.ts` swallows the import and nothing re-exports it — measured
  // `hasErrors: false` with zero diagnostics. A module that created nothing (an
  // ordinary prefetch) intersects neither set, which is what keeps the false
  // alarm closed.
  const reachable = new Set<unknown>(exported);

  for (const { created } of createdPerFile) {
    for (const registration of created) {
      reachable.add(registration);
    }
  }

  const unfinished = unfinishedModules(moduleCache, reportedModules, reachable);

  for (const modulePath of unfinished) {
    diagnostics.push({
      severity: 'error',
      file: hooksDirRelative(scanRoot, modulePath),
      reason:
        'never finished loading, yet a scanned hook file exported a registration it created — so a hook would bind from a module whose evaluation did not complete',
      suggestions: [
        'Fix the error this module throws at import time; a hook file importing it may be swallowing it with try/catch.',
      ],
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

  reportUnexportedRegistrations(
    createdPerFile,
    exported,
    valuesExportedByUnfinishedModules(moduleCache),
    diagnostics,
  );

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
    exportsUnusable: boolean;
  }[],
  exported: Set<unknown>,
  exportedByBroken: Set<unknown>,
  diagnostics: HookDiagnostic[],
): void {
  for (const { file, created, exportsUnusable } of createdPerFile) {
    if (exportsUnusable) {
      continue;
    }

    // Two sets, because they answer two different questions. `exported` is what
    // a **scanned file** exposed, which is what makes a registration reachable.
    // `exportedByBroken` is what an **unfinished** module exposed, which is the
    // only case where "you forgot to export this" is a false sentence — see
    // {@link valuesExportedByUnfinishedModules}.
    const missing = created.filter(
      (registration) =>
        !exported.has(registration) && !exportedByBroken.has(registration),
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
  ): { ids: string[]; anchor: string } | undefined => {
    // Rendered once, here, and carried to every diagnostic this registration
    // produces. `describeTarget` walks the user's value, so re-rendering per
    // conflicting transaction re-ran their `get` traps.
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

    return { ids: resolution.ids, anchor };
  };

  for (const entry of collected) {
    const { registration } = entry;

    switch (registration.kind) {
      // Collected, not bound. `bound` is not incremented for either kind —
      // see the diagnostic below and `boundHookCount`'s own docblock: "bound
      // to something" is false for a registration nothing calls yet, and
      // counting it made "Loaded 1 hook(s)" true for a hook that could not
      // run, the same class of silence as an `afterEach` that never fires.
      case 'beforeAll':
      case 'afterAll':
        (registration.kind === 'beforeAll'
          ? runScoped.beforeAll
          : runScoped.afterAll
        ).push(entry);

        // A load-time diagnostic, not silence. Run-scoped execution is story
        // 575.8's acceptance criteria (see `beforeAll`/`afterAll`'s own
        // docblocks in `hook-api.ts`) — until it lands, a hook registered
        // here is indistinguishable, from the user's side, from one that
        // will run: no error, no warning, "Loaded 1 hook(s)" in the debug
        // log. `info` because collection itself succeeded; this is a status,
        // not a failure.
        diagnostics.push({
          severity: 'info',
          file: entry.file,
          kind: registration.kind,
          exportName: entry.exportName,
          reason:
            'is collected but not executed yet — run-scoped hook execution is story 575.8',
        });
        break;

      case 'defineSample': {
        const resolved = resolve(entry, registration.target);

        if (!resolved) {
          break;
        }

        bound += 1;

        // Set-once per transaction. 575.6 declares it; this story enforces it,
        // because load time is the only place the target → transaction mapping
        // exists.
        //
        // Collected and reported **per rival**, not per transaction: two hooks
        // sharing a two-selector target used to print two byte-identical error
        // lines, and a 240-selector target printed 240 — one message the user
        // cannot read, saying one thing.
        const rivals = new Map<CollectedRegistration, number>();

        for (const id of resolved.ids) {
          const owner = sampleOwner.get(id);

          if (owner) {
            rivals.set(owner, (rivals.get(owner) ?? 0) + 1);
            continue;
          }

          sampleOwner.set(id, entry);
          sampleDefinitions.set(id, registration.callback);
        }

        for (const [owner, count] of rivals) {
          diagnostics.push(
            conflict(
              'defineSample',
              owner,
              entry,
              count === 1
                ? "that transaction's sample"
                : `the sample for ${count} of those transactions`,
              resolved.anchor,
            ),
          );
        }

        break;
      }

      case 'beforeEach': {
        const resolved = resolve(entry, registration.target);

        if (resolved) {
          bound += 1;
        }

        for (const id of resolved?.ids ?? []) {
          hooksFor(perTransaction, id).beforeEach.push(registration.callback);
        }

        break;
      }

      case 'afterEach': {
        const resolved = resolve(entry, registration.target);

        if (resolved) {
          bound += 1;
        }

        for (const id of resolved?.ids ?? []) {
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
                describeTarget(undefined),
              ),
            );
            break;
          }

          globalAuthorize = entry;
          globalAuthorizeCallback = registration.callback;
          bound += 1;
          break;
        }

        const resolved = resolve(entry, registration.target);

        if (resolved) {
          bound += 1;
        }

        if (!resolved) {
          break;
        }

        // Per rival, not per transaction — see the `defineSample` branch.
        const rivals = new Map<CollectedRegistration, number>();

        for (const id of resolved.ids) {
          const owner = targetedAuthorize.get(id);

          if (owner) {
            rivals.set(owner, (rivals.get(owner) ?? 0) + 1);
            continue;
          }

          targetedAuthorize.set(id, entry);
          targetedAuthorizeCallback.set(id, registration.callback);
        }

        for (const [owner, count] of rivals) {
          diagnostics.push(
            conflict(
              'authorize',
              owner,
              entry,
              count === 1
                ? "that transaction's authorize hook"
                : `the authorize hook for ${count} of those transactions`,
              // `rivals` is only non-empty when `resolved` is set, so there is
              // no fallback to write here — and writing one would re-render the
              // user's target, which is the double-trap-run this parameter
              // exists to prevent.
              resolved.anchor,
            ),
          );
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

/**
 * One diagnostic, one line — a property of the renderer, not of its inputs.
 *
 * Both halves of a diagnostic can carry a newline. `reason` wraps whatever the
 * failure said, and jiti's `ParseError` message ends with a newline and an
 * absolute path, which put a bare unindented `/private/var/…/a-broken.ts:1:17`
 * on its own line in the middle of {@link hookResolutionError}'s list. `anchor`
 * is user data too: `describeTarget` renders a selector string verbatim, so a
 * selector containing a newline breaks the same contract. Collapsing the
 * assembled line covers every field at once, including any added later.
 *
 * Only the *rendered* line is collapsed. `HookDiagnostic.reason` keeps its
 * original text, because 575.10's `sampler validate` renders the same array and
 * may want to lay a long parse error out differently.
 */
export function formatDiagnostic(diagnostic: HookDiagnostic): string {
  const head = [
    diagnostic.exportName === undefined
      ? undefined
      : // Bounded like every other user string: an export **name** comes from
        // `ownKeys` and is as user-controlled as the value behind it. A
        // 300 000-character key produced a 300 KB message through this line
        // alone, in a renderer whose whole job is to bound one.
        `export "${truncateLabel(diagnostic.exportName)}"`,
    diagnostic.kind,
    diagnostic.anchor,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(' ');

  return sanitizeLine(
    `${diagnostic.file || '<hooks>'}: ${head ? `${head} — ` : ''}${diagnostic.reason}`,
  );
}

/**
 * Everything that has to be true of a rendered line, in one place.
 *
 * Round 2's `.replace(/\s+/g, ' ')` closed the newline case but stops one
 * character class short: JavaScript's `\s` matches neither `ESC` (U+001B) nor
 * `NEL` (U+0085) — verified — so a selector or a thrown message carrying either
 * still rewrote the terminal in the middle of the aggregated list. `\p{Cc}` is
 * C0 (U+0000–U+001F), `DEL` (U+007F) and C1 (U+0080–U+009F), which covers both
 * and every other control character with them.
 *
 * The second class is the **bidi** controls plus the BOM, listed explicitly
 * rather than taken as `\p{Cf}`. `\p{Cf}` would be the obvious shorthand and is
 * wrong: it also contains ZWJ (U+200D) and ZWNJ (U+200C), so it turns a
 * legitimate emoji family sequence into three separate glyphs and breaks
 * Devanagari conjuncts and Persian word-joining — measured, in a message a user
 * is meant to read. Those joiners cannot move a cursor. What can is the
 * embedding/override/isolate set (U+202A–U+202E, U+2066–U+2069), the directional
 * marks (U+200E, U+200F, U+061C) and the BOM (U+FEFF), which is what this class
 * names. The Unicode **TAG** block (U+E0000–U+E007F) is in it for a different
 * reason: it does not move a cursor, it is simply invisible, which makes it a
 * way to smuggle text into a message the user is being asked to trust.
 *
 * Replaced with a space rather than deleted: dropping the control would join the
 * text on either side of it into one token that was never in the user's file.
 */
function sanitizeLine(line: string): string {
  return line
    .replaceAll(
      /[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u{E0000}-\u{E007F}]/gu,
      ' ',
    )
    .replaceAll(/\s+/gu, ' ')
    .trim();
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

  if (errors.length === 0) {
    // `HookRunner.init` gates on `hasErrors`, but this function is exported and
    // 575.10's `sampler validate` renders the same array — and with no errors it
    // used to produce "0 sampler hook problem(s) must be fixed before a test run
    // can start:" followed by nothing at all. A caller that reaches here has a
    // bug; saying so beats handing the user an empty accusation.
    throw new ThymianBaseError(
      'hookResolutionError was called with no error diagnostics; check `hasErrors` before building the error.',
      { name: 'HookResolutionErrorMisuse' },
    );
  }

  // Sanitized like the lines are. `suggestions` is the other half of what a user
  // sees and it reaches the terminal on its own path, so a suggestion carrying
  // an ESC or a newline — `suggestionsOf` only checks the elements are strings,
  // never what is in them — rewrote the terminal after `formatDiagnostic` had
  // been careful not to.
  const suggestions = [
    ...new Set(
      errors.flatMap((diagnostic) =>
        (diagnostic.suggestions ?? []).map(sanitizeLine),
      ),
    ),
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
