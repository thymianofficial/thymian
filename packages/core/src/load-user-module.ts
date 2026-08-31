import { realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Jiti } from 'jiti';

import { ThymianBaseError } from './thymian.error.js';

// A user-supplied specifier is exactly one of two kinds, decided
// syntactically: LOCAL (./, ../, or absolute — a path into the current
// project) or BARE (everything else — an installed package). Both are
// resolved with Node's own resolver and loaded with native `import()`; the
// only special case is a LOCAL `.ts` file, which is transpiled with jiti.
//
//   - from node_modules (bare): resolves to .js / .mjs / .cjs only
//     (a package shipping unbuilt .ts source is declined)
//   - from the current project (local): .js / .mjs / .cjs / .ts, and the
//     path must carry an explicit file extension (no extensionless / index
//     / directory guessing)

export type UserModuleResolution =
  { ok: true; path: string } | { ok: false; reason?: string };

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const LOADABLE_EXTENSIONS = new Set(['.ts', ...JS_EXTENSIONS]);

/**
 * The shared loadable-extension / declaration-file predicate. Returns a
 * framed reason string when `filePath` is not a loadable kind, or `undefined`
 * when it is. Operates on the path string alone (no filesystem access), so it
 * is reused by both halves of this module: `resolveLocal` guards the requested
 * path AND its realpath with it, and `loadUserModule` re-applies it so a
 * direct call cannot bypass the resolve half's decisions.
 *
 * Exported for the later consumers that will share this exact check rather
 * than hand-copying it — the rule-set glob filter and the plugin loader —
 * neither of which is wired up in this change yet.
 */
export function unloadableReason(filePath: string): string | undefined {
  const base = path.basename(filePath);

  if (base.endsWith('.d.ts')) {
    return `"${base}" is a TypeScript declaration file (.d.ts) — declaration files are never loadable, regardless of contents.`;
  }

  const ext = path.extname(filePath);

  if (ext === '.mts' || ext === '.cts') {
    return `"${ext}" is not a loadable extension — .mts/.cts are not supported for rules, rule sets, or plugins; use .ts instead.`;
  }

  if (!LOADABLE_EXTENSIONS.has(ext)) {
    return `"${base}" does not have a loadable extension — expected one of .ts, .js, .mjs, .cjs${
      ext ? ` (found "${ext}")` : ' (no extension)'
    }.`;
  }

  return undefined;
}

/**
 * Extension casing is case-sensitive against the on-disk (realpath) casing.
 * On a case-preserving-but-insensitive filesystem, `realpathSync.native`
 * silently corrects a mis-cased request to the real on-disk name; this
 * catches that correction so a mis-cased module is declined with a framed
 * reason instead of silently loading (or silently skipping, for the glob
 * filter).
 */
export function miscasedExtension(
  requestedPath: string,
  canonicalPath: string,
): string | undefined {
  const requestedExt = path.extname(requestedPath);
  const canonicalExt = path.extname(canonicalPath);

  if (
    requestedExt !== canonicalExt &&
    requestedExt.toLowerCase() === canonicalExt.toLowerCase()
  ) {
    return `"${requestedExt}" does not match the on-disk casing "${canonicalExt}" for "${path.basename(canonicalPath)}" — extension casing is case-sensitive.`;
  }

  return undefined;
}

/**
 * True when a specifier names a file by path — a relative spelling (`.`, `..`,
 * `./`, `../`, and the Windows `.\` / `..\` variants) or an absolute path —
 * rather than a bare installed-package name. The single source of truth for
 * the local-vs-package distinction, shared with consumers of the seam so a
 * caller never re-derives (and drifts from) this rule.
 */
export function isLocalSpecifier(specifier: string): boolean {
  return (
    // The bare directory references `.` / `..` are local, not package names
    // (they would otherwise resolve the cwd's or parent's own package.json).
    specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    // Windows-native relative spellings (`.\x`, `..\x`). Forward slashes are
    // the cross-platform norm and what the generator emits, but a hand-written
    // backslash path must not be mistaken for a package name.
    specifier.startsWith('.\\') ||
    specifier.startsWith('..\\') ||
    path.isAbsolute(specifier)
  );
}

function resolveLocal(specifier: string, cwd: string): UserModuleResolution {
  const requestedAbsolute = path.isAbsolute(specifier)
    ? specifier
    : path.resolve(cwd, specifier);

  // Guard the requested path: local specifiers must carry an explicit,
  // loadable extension (no extensionless / index / directory guessing).
  const requestedReason = unloadableReason(requestedAbsolute);

  if (requestedReason) {
    return { ok: false, reason: requestedReason };
  }

  let canonical: string;

  try {
    canonical = realpathSync.native(requestedAbsolute);
  } catch {
    // Does not exist (or is unreachable) — an ordinary "not found", which
    // the caller can phrase itself; no reason needed here.
    return { ok: false };
  }

  // Guard the RESOLVED target too: a symlink may point at an unloadable kind
  // (e.g. `./alias.ts` -> `real.d.ts` / `real.mts`), which must be declined
  // here — not surface later as a differently-framed load error.
  const canonicalReason = unloadableReason(canonical);

  if (canonicalReason) {
    return { ok: false, reason: canonicalReason };
  }

  const casingReason = miscasedExtension(requestedAbsolute, canonical);

  if (casingReason) {
    return { ok: false, reason: casingReason };
  }

  // Reject a directory whose name merely ends in a loadable extension (e.g. a
  // directory literally named `x.js`) — the extension check alone would pass
  // it, and it would then surface a raw ERR_UNSUPPORTED_DIR_IMPORT downstream.
  let stats: ReturnType<typeof statSync>;

  try {
    stats = statSync(canonical);
  } catch {
    return { ok: false };
  }

  if (!stats.isFile()) {
    return {
      ok: false,
      reason: `"${specifier}" resolves to "${path.basename(canonical)}", which is not a regular file.`,
    };
  }

  return { ok: true, path: canonical };
}

// One `createRequire` anchor per normalised cwd, memoised. Normalising the
// key deduplicates spellings of the same cwd — the raw-cwd cache mis-answered
// after `process.chdir`. It does NOT bound the number of *distinct*
// cwds: the map grows one entry per project the process ever loads from. That
// is harmless for the CLI (a single, fixed cwd per invocation); a long-lived
// multi-project consumer should add LRU eviction here and to `moduleCache`.
const userRequireByCwd = new Map<string, NodeJS.Require>();

function getUserRequire(cwd: string): NodeJS.Require {
  const normalisedCwd = path.resolve(cwd);
  let anchoredRequire = userRequireByCwd.get(normalisedCwd);

  if (!anchoredRequire) {
    anchoredRequire = createRequire(path.join(normalisedCwd, 'noop.cjs'));
    userRequireByCwd.set(normalisedCwd, anchoredRequire);
  }

  return anchoredRequire;
}

// Core's own install directory — the second bare-specifier anchor.
const coreRequire = createRequire(import.meta.url);

// Resolves a bare specifier (an installed package) with Node's OWN resolver,
// `require.resolve`, from two anchors in order: the user's project, then
// core's install dir. Using the native resolver — rather than reimplementing
// package resolution — means `exports`/`main`/legacy-`index`/deep subpaths,
// and resolver hooks such as Yarn PnP, all behave exactly as Node does
// elsewhere. We only add the loadable-set policy on top: the resolved file
// must be built JavaScript (.js/.mjs/.cjs); a package shipping unbuilt .ts
// source is declined. (A bare specifier is loaded with native `import()`, so
// jiti is never reached for it.)
function resolveBare(specifier: string, cwd: string): UserModuleResolution {
  const anchors = [getUserRequire(cwd), coreRequire];
  let resolved: string | undefined;
  let installedButUnresolvable: string | undefined;

  for (const anchoredRequire of anchors) {
    try {
      resolved = anchoredRequire.resolve(specifier);
      break;
    } catch (error) {
      if (isModuleNotFound(error)) {
        // Not installed under this anchor — try the next one.
        continue;
      }

      // Installed, but Node's resolver refused it (e.g. its `exports` map
      // provides no Node/CJS entry, or its package.json is invalid). Report
      // that rather than silently treating it as "not found".
      installedButUnresolvable ??= `"${specifier}" is installed but could not be resolved: ${describeUnexpectedError(error)}`;
    }
  }

  if (resolved === undefined) {
    return installedButUnresolvable
      ? { ok: false, reason: installedButUnresolvable }
      : { ok: false };
  }

  // `require.resolve` returns a bare id (not an absolute path) for a Node
  // builtin — builtins are not loadable user modules.
  if (!path.isAbsolute(resolved)) {
    return {
      ok: false,
      reason: `"${specifier}" is a Node.js builtin module — builtins are not loadable user modules.`,
    };
  }

  let canonical: string;

  try {
    canonical = realpathSync.native(resolved);
  } catch {
    return {
      ok: false,
      reason: `"${specifier}" resolved to "${resolved}", which does not exist on disk.`,
    };
  }

  const ext = path.extname(canonical);

  if (ext === '.ts' || ext === '.mts' || ext === '.cts') {
    return {
      ok: false,
      reason: `"${specifier}" ships unbuilt TypeScript source (${path.basename(canonical)}); publish built JavaScript.`,
    };
  }

  if (!JS_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      reason: `"${specifier}" resolved to "${path.basename(canonical)}", which is not a loadable JavaScript file (expected .js, .mjs, or .cjs).`,
    };
  }

  return { ok: true, path: canonical };
}

function isModuleNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND'
  );
}

function describeUnexpectedError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Resolves a user-supplied rule/rule-set/plugin specifier to an absolute,
 * canonical filesystem path — or declines it with a reason. Never throws:
 * every internal fs/URL error is caught and mapped to `{ ok: false, reason }`.
 */
export function resolveUserModule(
  specifier: string,
  options: { cwd: string },
): UserModuleResolution {
  try {
    return isLocalSpecifier(specifier)
      ? resolveLocal(specifier, options.cwd)
      : resolveBare(specifier, options.cwd);
  } catch (error) {
    return { ok: false, reason: describeUnexpectedError(error) };
  }
}

// jiti transpile-cache location — pinned deliberately. It is placed under the
// current user's home cache directory rather than the OS tmp dir. A fixed path
// in the shared OS tmp dir (e.g. `/tmp/...` on Linux) is world-writable, so a
// local attacker who knows a rule's path and public source can pre-seed a
// poisoned cache entry that the victim then executes — jiti reads a cache file
// back whenever its trailing version/source hash matches. A per-user location
// under `homedir()` keeps the cache predictable (the reason for pinning it)
// while staying inside the user's own permission domain, where other users
// cannot plant entries.
const JITI_FS_CACHE_DIR = path.join(homedir(), '.cache', 'thymian', 'jiti');

let jitiPromise: Promise<Jiti> | undefined;

function getJiti(): Promise<Jiti> {
  // Lazily, dynamically imported — and memoised — so a JS-only run never
  // instantiates jiti at all: the JS path never pays for it. On
  // failure the memo is cleared so a later `.ts` load can re-attempt, rather
  // than pinning a transient `import('jiti')`/createJiti error forever.
  jitiPromise ??= import('jiti')
    .then(({ createJiti }) =>
      createJiti(import.meta.url, { fsCache: JITI_FS_CACHE_DIR }),
    )
    .catch((error: unknown) => {
      jitiPromise = undefined;
      throw error;
    });

  return jitiPromise;
}

// Keyed by canonical (realpath) path. A *successful* load is pinned for the
// process lifetime: this is both the concurrent in-flight dedupe AND the
// exactly-once execution guarantee across every path spelling. A
// *rejected* load is evicted (see below) so a transient failure can be
// retried instead of being pinned forever. No bespoke cycle-detection
// machinery — ordinary module-graph import cycles are jiti/Node's concern,
// handled natively.
const moduleCache = new Map<string, Promise<unknown>>();

async function importByExtension(canonicalPath: string): Promise<unknown> {
  if (path.extname(canonicalPath) === '.ts') {
    const jiti = await getJiti();

    return jiti.import(canonicalPath);
  }

  return import(pathToFileURL(canonicalPath).href);
}

/**
 * Loads an already-resolved, canonical module path. Re-runs the shared
 * guard (`unloadableReason`) so a direct call cannot bypass the resolve
 * half's decisions — it still yields a framed error, never a raw
 * "does not use default export" surprise.
 */
export async function loadUserModule(canonicalPath: string): Promise<unknown> {
  const reason = unloadableReason(canonicalPath);

  if (reason) {
    throw new ThymianBaseError(reason, {
      name: 'UserModuleLoadError',
      suggestions: [
        'Rules, rule sets, and plugins must be a .ts, .js, .mjs, or .cjs file — not .d.ts, .mts, or .cts.',
      ],
      // Reuses the existing rule-load-error reference page; a dedicated
      // user-module-load-error page ships with the docs work.
      ref: 'https://thymian.dev/references/errors/rule-load-error/',
    });
  }

  const cached = moduleCache.get(canonicalPath);

  if (cached) {
    return cached;
  }

  // Evict on rejection so only successful loads are pinned; a transient
  // failure (a file that briefly vanished, a one-off jiti/transpile error)
  // can then be retried rather than returning the same rejection forever.
  // Concurrency stays safe: the `.catch` runs only after the in-flight
  // promise settles, and concurrent callers share this one promise.
  const promise = importByExtension(canonicalPath).catch((error: unknown) => {
    moduleCache.delete(canonicalPath);
    throw error;
  });

  moduleCache.set(canonicalPath, promise);

  return promise;
}

// Exposed for tests only (module-level singletons make cross-test isolation
// otherwise impossible): resets the exactly-once module cache and the
// lazily-instantiated jiti singleton.
export function _resetUserModuleLoaderStateForTests(): void {
  moduleCache.clear();
  jitiPromise = undefined;
}
