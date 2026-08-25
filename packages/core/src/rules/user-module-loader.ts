import { realpathSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Jiti } from 'jiti';
import * as resolveExports from 'resolve.exports';

import { ThymianBaseError } from '../thymian.error.js';
import { isRecord } from '../utils.js';

// The resolution contract implemented here is normative and epic-level
// (GitHub issue thymianofficial/thymian-internal#725 §4) — it is not to be
// redefined by any consumer. A specifier is exactly one of two kinds,
// decided syntactically: local (./, ../, or absolute) or bare (everything
// else, resolved as an installed package).

export type UserModuleResolution =
  { ok: true; path: string } | { ok: false; reason?: string };

const LOADABLE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs']);
const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const BUILTIN_MODULES = new Set(builtinModules);

/**
 * The one shared loadable-extension / declaration-file predicate (§4.6).
 * Consumers (the rule-set glob filter, the plugin loader) call this rather
 * than hand-copying the check. Operates on a path string alone — it does
 * not touch the filesystem, so it also guards `loadUserModule` against
 * being called directly with an unloadable kind (the load half cannot
 * bypass the resolve half's guards).
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

function isLocalSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    path.isAbsolute(specifier)
  );
}

function isNodeBuiltin(nameOrSpecifier: string): boolean {
  const bare = nameOrSpecifier.startsWith('node:')
    ? nameOrSpecifier.slice('node:'.length)
    : nameOrSpecifier;

  return BUILTIN_MODULES.has(bare);
}

function splitPackageSpecifier(specifier: string): {
  name: string;
  subpath: string;
} {
  const parts = specifier.split('/');

  if (specifier.startsWith('@')) {
    return {
      name: parts.slice(0, 2).join('/'),
      subpath: parts.slice(2).join('/'),
    };
  }

  return { name: parts[0] ?? specifier, subpath: parts.slice(1).join('/') };
}

function resolveLocal(specifier: string, cwd: string): UserModuleResolution {
  const requestedAbsolute = path.isAbsolute(specifier)
    ? specifier
    : path.resolve(cwd, specifier);

  const reason = unloadableReason(requestedAbsolute);

  if (reason) {
    return { ok: false, reason };
  }

  let canonical: string;

  try {
    canonical = realpathSync.native(requestedAbsolute);
  } catch {
    // Does not exist (or is unreachable) — an ordinary "not found", which
    // the caller can phrase itself; no reason needed here (§4.4).
    return { ok: false };
  }

  const casingReason = miscasedExtension(requestedAbsolute, canonical);

  if (casingReason) {
    return { ok: false, reason: casingReason };
  }

  return { ok: true, path: canonical };
}

// One `createRequire` anchor per normalised cwd, memoised — never an
// unbounded process-global keyed by the raw cwd string (§4.4).
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

// Core's own install directory — the second bare-specifier anchor (§4.1).
const coreRequire = createRequire(import.meta.url);

type PackageJson = Record<string, unknown> & { name?: string };

type LocatePackageResult =
  | { kind: 'found'; root: string; pkg: PackageJson }
  | { kind: 'broken'; reason: string }
  | { kind: 'not-found' };

// "Not installed" is distinguished from "installed but broken"
// (ERR_PACKAGE_PATH_NOT_EXPORTED, an invalid package.json) — the latter is
// reported, not silently treated as "not found" (§4.4).
function locatePackage(
  anchoredRequire: NodeJS.Require,
  packageName: string,
): LocatePackageResult {
  let packageJsonPath: string;

  try {
    packageJsonPath = anchoredRequire.resolve(`${packageName}/package.json`);
  } catch (error) {
    // Node resolves this "/package.json" subpath by reading package.json
    // itself, so a syntactically invalid package.json fails right here
    // (ERR_INVALID_PACKAGE_CONFIG) rather than at the later `require()` call
    // below. ERR_PACKAGE_PATH_NOT_EXPORTED means the package IS installed,
    // just doesn't expose its own package.json via `exports`. Either way,
    // the package is present but broken — not "not found".
    if (
      isRecord(error) &&
      (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
        error.code === 'ERR_INVALID_PACKAGE_CONFIG')
    ) {
      return {
        kind: 'broken',
        reason: `"${packageName}" is installed but broken: ${describeUnexpectedError(error)}`,
      };
    }

    return { kind: 'not-found' };
  }

  let pkg: PackageJson;

  try {
    pkg = anchoredRequire(packageJsonPath) as PackageJson;
  } catch (error) {
    return {
      kind: 'broken',
      reason: `"${packageName}"'s package.json at "${packageJsonPath}" is invalid: ${describeUnexpectedError(error)}`,
    };
  }

  return { kind: 'found', root: path.dirname(packageJsonPath), pkg };
}

function resolveBare(specifier: string, cwd: string): UserModuleResolution {
  if (isNodeBuiltin(specifier)) {
    return {
      ok: false,
      reason: `"${specifier}" is a Node.js builtin module — builtins are not loadable user modules.`,
    };
  }

  const { name, subpath } = splitPackageSpecifier(specifier);

  if (isNodeBuiltin(name)) {
    return {
      ok: false,
      reason: `"${specifier}" is a Node.js builtin module — builtins are not loadable user modules.`,
    };
  }

  const anchors = [getUserRequire(cwd), coreRequire];
  let located: { root: string; pkg: PackageJson } | undefined;
  let brokenReason: string | undefined;

  for (const anchoredRequire of anchors) {
    const result = locatePackage(anchoredRequire, name);

    if (result.kind === 'found') {
      located = result;
      break;
    }

    if (result.kind === 'broken' && !brokenReason) {
      brokenReason = result.reason;
    }
  }

  if (!located) {
    // Not installed under either anchor — an ordinary "not found" (§4.4) —
    // unless one anchor found it installed but broken, which is reported.
    return brokenReason ? { ok: false, reason: brokenReason } : { ok: false };
  }

  const { root, pkg } = located;
  const entry = subpath ? `./${subpath}` : '.';
  let relativeTarget: string | undefined;

  if (typeof pkg.exports === 'string' || isRecord(pkg.exports)) {
    try {
      // No `conditions`/`require`/`browser` options: resolve.exports's own
      // defaults already produce exactly {"default","import","node"} (§4.1)
      // — this is not an accident of omission, it is the intended call.
      const matches = resolveExports.exports(pkg, entry);

      relativeTarget = matches?.[0];
    } catch (error) {
      return {
        ok: false,
        reason: `"${specifier}" is installed but its "exports" map does not provide "${entry}": ${(error as Error).message}`,
      };
    }
  }

  if (!relativeTarget) {
    if (subpath) {
      // No exports map and a deep subpath was requested: legacy fields
      // (main) only ever describe the package root, so there is nothing to
      // resolve a deep import against — treat as "not found" rather than
      // guessing.
      return { ok: false };
    }

    relativeTarget =
      typeof pkg.main === 'string' && pkg.main.length > 0
        ? pkg.main
        : 'index.js';
  }

  const absoluteTarget = path.resolve(root, relativeTarget);
  let canonical: string;

  try {
    canonical = realpathSync.native(absoluteTarget);
  } catch {
    return {
      ok: false,
      reason: `"${specifier}" is installed but its resolved entry "${relativeTarget}" does not exist on disk.`,
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

function describeUnexpectedError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Resolves a user-supplied rule/rule-set/plugin specifier to an absolute,
 * canonical filesystem path — or declines it with a reason. Never throws:
 * every internal fs/URL error is caught and mapped to `{ ok: false, reason }`
 * (§4.4).
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

// jiti transpile-cache location (epic #725 §7 — a required, documented
// decision, not an inherited default): jiti's own default prefers
// `<cwd>/node_modules/.cache/jiti` when that directory already exists and
// falls back to the OS tmp dir otherwise — an environment-dependent split.
// We pin it to a single, predictable location under the OS tmp dir instead,
// so transpiled user rule/plugin source never lands inside the user's own
// project tree regardless of what happens to exist on disk.
const JITI_FS_CACHE_DIR = path.join(tmpdir(), 'thymian-jiti-cache');

let jitiPromise: Promise<Jiti> | undefined;

function getJiti(): Promise<Jiti> {
  // Lazily, dynamically imported — and memoised — so a JS-only run never
  // instantiates jiti at all (§4.1/AC4): the JS path never pays for it.
  jitiPromise ??= import('jiti').then(({ createJiti }) =>
    createJiti(import.meta.url, { fsCache: JITI_FS_CACHE_DIR }),
  );

  return jitiPromise;
}

// Keyed by canonical (realpath) path. Never cleared: this is both the
// concurrent in-flight dedupe AND the exactly-once execution guarantee
// across every path spelling, for the lifetime of the process (§4.5). No
// bespoke cycle-detection machinery — ordinary module-graph import cycles
// are jiti/Node's concern, handled natively.
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
      ref: 'https://thymian.dev/references/errors/user-module-load-error/',
    });
  }

  const cached = moduleCache.get(canonicalPath);

  if (cached) {
    return cached;
  }

  const promise = importByExtension(canonicalPath);

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
