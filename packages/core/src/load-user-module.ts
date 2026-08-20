/**
 * The single seam through which Thymian loads a *user-supplied* module — a rule, a rule set or a
 * plugin. Its contract, in order:
 *
 * 1. **Resolve first, load second.** The two steps are separate and separately inspectable:
 *    callers need the resolved path in its own right (`loadRuleSet` uses it as a glob base) and
 *    they need resolution failure to stay distinguishable from load failure, so each keeps its
 *    own user-facing error message. `resolveUserModule` therefore never throws — it answers
 *    `undefined` and lets the caller phrase the error.
 * 2. **Dispatch on the *resolved* extension, before any import.** TypeScript goes through jiti,
 *    everything else through a plain dynamic `import()`.
 * 3. **Never import-then-retry, and never evaluate twice.** A module's top-level side effects
 *    must run exactly once — across BOTH dispatch branches, across every spelling of its path,
 *    and under concurrency. A cycle is reported rather than deadlocked.
 * 4. **jiti only for TypeScript, imported lazily.** `loadRules` runs on every single invocation
 *    for all built-in rules, and those are JavaScript; that path must never pay for jiti.
 *
 * Two limitations are deliberate and measured against jiti 2.6.1, not oversights:
 *
 * - **TypeScript sources must use `export default`.** `module.exports = …` in a `.ts`/`.cts` file
 *   produces a namespace with no `default` key, and jiti's interop makes that shape *identical*
 *   to a module with only named exports (`interopDefault: false` does not separate them either).
 *   Synthesising a default would let a named-only module masquerade as a rule, so this seam
 *   reports it as "no default export" rather than guessing. Tracked as epic follow-up work.
 * - **Only JavaScript and TypeScript are loadable**, enforced as an allow-list at resolution so
 *   the caller phrases the error. See {@link LOADABLE_EXTENSION} for why each excluded extension
 *   is excluded — including `.node`, which is not importable on the `engines.node` floor at all.
 * - **tsconfig `paths` aliases are not honoured in a user TypeScript module.** jiti is given no
 *   `alias` option and does not read the user's `tsconfig.json`, so a rule importing `@lib/x.js`
 *   under `paths: { "@lib/*": [...] }` resolves and then fails at load with a raw
 *   `MODULE_NOT_FOUND`. Nested *package* imports from the user's own `node_modules` DO work; it is
 *   specifically the alias case. Probably the first limitation a real user writing TypeScript
 *   rules meets, so it wants a decision rather than silence.
 * Bare specifiers resolve installed packages first — the user's project, then core's own install
 * directory — and only fall back to `<cwd>/<specifier>` when nothing is installed under that name.
 * Two reasons for that order: a package the user named in their config is theirs, so a globally
 * installed CLI must not answer with its own copy of a colliding name; and preferring the cwd path
 * up front is what let a same-named file or directory shadow an installed package and silently run
 * in its place. Core's anchor stays so Thymian's bundled rule packages keep resolving when the
 * user's project does not carry them.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Jiti } from 'jiti';

import { ThymianBaseError } from './thymian.error.js';
import { isRecord } from './utils.js';

const require = createRequire(import.meta.url);

/**
 * Resolves through Node's own resolver, trying the **user's project before core's install
 * directory**.
 *
 * Anchoring only at core's directory (the single `require` above) meant a package present only in
 * the user's `node_modules` was invisible to it and fell through to the jiti fallback — so a
 * plain-JavaScript rule package paid for jiti, breaking contract item 4 (confirmed with
 * `JITI_DEBUG=1`). It also meant a name the user installed lost to a Thymian dependency of the
 * same name, which for a globally installed CLI is the wrong answer twice over.
 *
 * Only **bare** specifiers are affected: a relative one is already an absolute path by the time it
 * gets here, and both anchors resolve an absolute path identically.
 */
/**
 * Cwd-anchored resolvers, memoised. `resolveThroughRequire` runs for every specifier — including
 * every built-in rule on every invocation, the path the file header singles out as needing to stay
 * cheap — and `cwd` is stable within a run, so building the anchor each time was pure waste.
 */
const cwdRequireCache = new Map<string, NodeJS.Require>();

function requireFrom(cwd: string): NodeJS.Require {
  let anchored = cwdRequireCache.get(cwd);

  if (anchored === undefined) {
    anchored = createRequire(pathToFileURL(path.join(cwd, '_')));
    cwdRequireCache.set(cwd, anchored);
  }

  return anchored;
}

function resolveThroughRequire(
  location: string,
  cwd: string,
): string | undefined {
  const anchors = [requireFrom(cwd), require];

  for (const anchor of anchors) {
    try {
      return anchor.resolve(location);
    } catch {
      // Not resolvable from this anchor — fall through to the next, then to jiti.
    }
  }

  return undefined;
}

/** Extensions jiti handles. `.tsx` is excluded on purpose — see the file header. */
const TYPESCRIPT_EXTENSION = /\.[cm]?ts$/;

/**
 * The extensions a user module may have — an ALLOW-list, because the loadable set is the closed
 * one and the unloadable set is not. A deny-list was tried and found wanting twice: `require.resolve`
 * answers with any existing absolute file regardless of extension, so everything unenumerated
 * resolved and then died in the native importer with a raw error. `.yaml`, `.yml`, `.md`, `.txt`,
 * `.toml`, `.json5` and `.jsonc` all gave `ERR_UNKNOWN_FILE_EXTENSION` unframed — the very class
 * of error `.json` had been declined to prevent.
 *
 * Deliberately excluded, each for its own reason:
 * - The JSX family (`.jsx`/`.tsx` and `.m`/`.c` variants): jiti's `jsx` option is off by default,
 *   so a `.tsx` yields a bare `ParseError` with no file or line, and Node rejects `.jsx` outright.
 * - `.json`: needs an `import ... with { type: 'json' }` attribute this seam does not pass, and
 *   nothing in Thymian consumes a JSON rule set. It resolves without any user typo, since `.json`
 *   is in jiti's own default extension list.
 * - `.node`: NOT importable on Node 22 at all — the `engines.node` floor and in the CI matrix —
 *   where it gives `ERR_UNKNOWN_FILE_EXTENSION`; addon imports need `--experimental-addon-modules`,
 *   which only exists on much later versions. Measured on 22.19 and 26.7.
 * - `.wasm`: does load on 22 and 26, but needs `--experimental-wasm-modules` on Node 20 (also in
 *   the matrix), and a valid wasm module exports no `default`, so it cannot carry a rule anyway.
 */
const LOADABLE_EXTENSION = /\.[cm]?[jt]s$/;

/**
 * Declaration files are never loadable. Case-insensitive: on Windows and default macOS volumes a
 * `Decl.D.TS` resolves fine, and a case-sensitive guard would wave through exactly the file it
 * exists to stop. Checked before {@link TYPESCRIPT_EXTENSION}, which `.d.ts` also matches.
 */
const DECLARATION_FILE = /\.d\.[cm]?ts$/i;

/**
 * Why a resolved path can never be loaded, or `undefined` when it can.
 *
 * Shared by both halves of the seam so they cannot drift: `resolveUserModule` turns a reason into
 * `undefined`, and `loadUserModule` turns it into a framed error. Without the second check a path
 * obtained some other way — a `loadRuleSet` glob, a config `path` — bypasses the guard entirely,
 * and a `.d.ts` then imports as an EMPTY module, so the caller reports "does not use default
 * export": the exact confusion the guard exists to prevent.
 */
function unloadableReason(resolvedPath: string): string | undefined {
  if (DECLARATION_FILE.test(resolvedPath)) {
    return 'a TypeScript declaration file contains no runtime code';
  }

  if (!LOADABLE_EXTENSION.test(resolvedPath)) {
    return 'only JavaScript and TypeScript modules can be loaded';
  }

  return undefined;
}

/** `./x`, `../x`, `.` or `..` — specifiers Node resolves against the importer, not `node_modules`. */
const RELATIVE_SPECIFIER = /^\.\.?(?:[/\\]|$)/;

/**
 * Memoised as the *promise*, not the resolved instance: `loadRules` resolves rule sources
 * concurrently, and memoising the instance would let several concurrent TypeScript loads each
 * kick off their own `import('jiti')`. Cleared on rejection, so one transient failure (a partial
 * install, EMFILE) does not poison every later TypeScript load in the process.
 */
let jitiInstance: Promise<Jiti> | undefined;

function getJiti(): Promise<Jiti> {
  // A type-only import of `Jiti` emits nothing under `verbatimModuleSyntax`, so this dynamic
  // import is the only `jiti` reference in the built output — that is what keeps it lazy.
  jitiInstance ??= import('jiti')
    .then(({ createJiti }) =>
      // `interopDefault` already defaults to `true`, and `fsCache` degrades gracefully rather
      // than throwing when its directory is unwritable (measured against 2.6.1) — so a
      // read-only or containerised CI needs no Thymian-specific cache option.
      // `JITI_FS_CACHE=false` is the existing escape hatch if one is ever wanted.
      //
      // `extensions` is narrowed to TypeScript so jiti DELEGATES `.js` to Node's loader instead
      // of registering it itself. With the default list, a `.js` module imported by both a
      // natively-loaded JS rule and a jiti-loaded TS rule lands in two registries and evaluates
      // TWICE, handing the two rules non-identical objects — measured, and the thing contract
      // item 3 forbids. Narrowing unifies them: one evaluation, `===` identical. Resolution is
      // unaffected (the list governs extension *guessing*, and every case here was measured
      // identical), because explicit paths and `.js`→`.ts` NodeNext mapping still work.
      createJiti(import.meta.url, {
        extensions: ['.ts', '.mts', '.cts'],
      }),
    )
    .catch((error: unknown) => {
      jitiInstance = undefined;

      throw error;
    });

  return jitiInstance;
}

async function resolveThroughJiti(
  location: string,
  cwd: string,
): Promise<string | undefined> {
  let jiti: Jiti;

  try {
    jiti = await getJiti();
  } catch {
    // Resolution never throws (contract item 1). A broken jiti install means "unresolved", and
    // the caller keeps ownership of the message the user actually sees.
    return undefined;
  }

  // `try: true` makes jiti answer `undefined` instead of throwing. The declared overload
  // widens `try` to `boolean`, which would hide that case, so the annotation restores it.
  const resolvedUrl: string | undefined = jiti.esmResolve(location, {
    try: true,
    // A hint only — jiti abandons it when the path misses, which is why relative specifiers are
    // anchored at `cwd` before they ever get here.
    parentURL: pathToFileURL(path.join(cwd, '_')),
  });

  if (resolvedUrl === undefined || !resolvedUrl.startsWith('file:')) {
    return undefined;
  }

  let resolvedPath: string;

  try {
    resolvedPath = fileURLToPath(resolvedUrl);
  } catch {
    // jiti can answer with a well-formed URL around a nonsense path — a Node builtin comes
    // back as `file:///<cwd>/node:fs` — which `fileURLToPath` may reject outright.
    return undefined;
  }

  // Same nonsense-path case, for the platforms where the conversion succeeds.
  return existsSync(resolvedPath) ? resolvedPath : undefined;
}

export interface ResolveUserModuleOptions {
  /**
   * Fall back to `<cwd>/<specifier>` when nothing is installed under that name. Default `true`.
   *
   * A *fallback*, not a preference: installed packages are resolved first, so a same-named file
   * or directory in `cwd` can never shadow one. Governs **bare** specifiers only — relative
   * specifiers are always anchored at `cwd` regardless of this flag, being unambiguously paths.
   */
  preferCwdRelative?: boolean;
}

/**
 * Resolves a user-supplied module specifier to an absolute filesystem path, or `undefined` when
 * the specifier does not name a loadable user module. Never throws.
 *
 * Resolution order stops at the first hit: `existsSync` on `<cwd>/<specifier>`, then
 * `require.resolve`, then jiti's `esmResolve`. `require.resolve` already handles TypeScript with
 * an explicit extension, so the jiti fallback is reached for *resolution* only by extensionless
 * and NodeNext `.js`→`.ts` specifiers.
 *
 * @param specifier The user's rule, rule-set or plugin specifier.
 * @param cwd Directory that path-like specifiers resolve against, that anchors the jiti fallback,
 *   and whose `node_modules` ancestor chain is searched for **bare** specifiers before core's own
 *   (see {@link resolveThroughRequire}).
 * @param options See {@link ResolveUserModuleOptions}.
 */
export async function resolveUserModule(
  specifier: string,
  cwd: string = process.cwd(),
  options: ResolveUserModuleOptions = {},
): Promise<string | undefined> {
  const { preferCwdRelative = true } = options;

  let resolved: string | undefined;

  if (RELATIVE_SPECIFIER.test(specifier)) {
    // A relative specifier is relative to the USER's cwd, never to core's install directory —
    // but `require` is anchored to the latter and jiti's `parentURL` is only a hint it abandons
    // when the path misses. Both would hand back Thymian's *own* modules as the user's rule
    // (`./index.js` resolves core's barrel), so anchor it here instead of delegating.
    // Unconditional: `preferCwdRelative` governs bare names, and a relative specifier is
    // unambiguously a path.
    const location = path.resolve(cwd, specifier);

    resolved =
      resolveThroughRequire(location, cwd) ??
      (await resolveThroughJiti(location, cwd));
  } else {
    // Installed packages FIRST. Preferring `<cwd>/<specifier>` up front is what let a same-named
    // file or directory shadow — and silently execute in place of — an installed package.
    resolved = resolveThroughRequire(specifier, cwd);

    if (
      resolved === undefined &&
      preferCwdRelative &&
      !path.isAbsolute(specifier)
    ) {
      // Nothing is installed under that name, so a local file or directory of that name is what
      // the user meant. Resolving the absolute path (rather than using it verbatim) keeps a
      // directory holding `index.js` or a `package.json` `main` working, which is the shape
      // today's `rule-loader` accepts for `rules: ['my-rules']`.
      const fileLocation = path.resolve(cwd, specifier);

      if (existsSync(fileLocation)) {
        resolved = resolveThroughRequire(fileLocation, cwd);
      }
    }

    resolved ??= await resolveThroughJiti(specifier, cwd);
  }

  if (resolved === undefined) {
    return undefined;
  }

  if (!path.isAbsolute(resolved)) {
    // `require.resolve` answers a builtin specifier with the bare id (`fs`, `node:fs`). That is
    // not a loadable user module, and passing it on would turn into a nonsense
    // `file://<cwd>/node:fs` import rather than the caller's "cannot resolve" message.
    return undefined;
  }

  let normalised: string;

  try {
    // `native` reports the *on-disk* casing. Both resolvers echo the caller's spelling, so on a
    // case-insensitive volume `./Rule.TS` would otherwise reach a dispatch that matches neither
    // branch. Symlinks are unaffected: both resolvers already return realpaths.
    normalised = realpathSync.native(resolved);
  } catch {
    return undefined;
  }

  if (unloadableReason(normalised) !== undefined) {
    return undefined;
  }

  return normalised;
}

/**
 * Collapses the spellings of one file to a single identity: `/base/x.ts`, `/base/sub/../x.ts` and
 * a symlink to it must not look like three modules. Without this the in-flight map keys on the raw
 * string and the same file evaluates once per spelling. Also fixes the dispatch for a mis-cased
 * path reaching this function directly (a `loadRuleSet` glob, a config `path`): only
 * `resolveUserModule` normalised casing, so `PLAIN.TS` matched no branch and died raw.
 */
function canonicalise(resolvedPath: string): string {
  try {
    return realpathSync.native(resolvedPath);
  } catch {
    // Not on disk — keep the caller's path so the import surfaces the real error.
    return path.resolve(resolvedPath);
  }
}

/**
 * The chain of user modules being evaluated on this async path.
 *
 * Node's loader and jiti's registry each resolve their own import cycles, but the in-flight map
 * cannot: a module that re-enters this seam during its own evaluation would await a promise only
 * its own return can settle, and the process hangs silently — Node exits 13, "Detected unsettled
 * top-level await". `AsyncLocalStorage` carries the chain into module top-level code on both
 * branches (verified), so re-entry is detectable and can be reported instead of hung.
 */
const evaluationChain = new AsyncLocalStorage<readonly string[]>();

/**
 * In-flight TypeScript loads, keyed by resolved path. jiti only populates its module cache once a
 * load *completes*, so without this two concurrent loads of one file evaluate it twice and return
 * two distinct namespaces — the double-evaluation contract item 3 forbids. Node's own loader
 * de-duplicates in flight, so the native branch needs no equivalent.
 */
const inFlightTypeScriptLoads = new Map<
  string,
  Promise<Record<string, unknown>>
>();

async function importNatively(
  resolvedPath: string,
): Promise<Record<string, unknown>> {
  const module: unknown = await import(pathToFileURL(resolvedPath).href);

  return isRecord(module) ? module : { default: module };
}

async function importThroughJiti(
  resolvedPath: string,
): Promise<Record<string, unknown>> {
  const jiti = await getJiti();
  const module = await jiti.import<unknown>(resolvedPath);

  // `export = <primitive>` yields the bare value, so `'default' in module` would throw a
  // `TypeError`. A non-object export can only ever have been a default.
  //
  // Note the boundary this draws, which is narrower than it looks: `isRecord` excludes
  // primitives, arrays and functions, so those gain a `default` — but `export = { … }`, the
  // natural rule-set shape, is a record and passes through unwrapped, where jiti's proxy answers
  // `'default' in module` with `false`. That is the SAME limitation as `module.exports = { … }`
  // documented in the file header, and for the same reason: through the proxy it is
  // indistinguishable from a module with only named exports, so synthesising a default here
  // would let a named-only module masquerade as a rule. Pinned by test, not left implicit.
  return isRecord(module) ? module : { default: module };
}

/**
 * Imports an already-resolved user module and returns its **namespace** — not its default
 * export, because callers check `'default' in module` to detect a missing default export.
 *
 * @param resolvedPath An absolute path from {@link resolveUserModule}.
 */
export async function loadUserModule(
  resolvedPath: string,
): Promise<Record<string, unknown>> {
  if (!path.isAbsolute(resolvedPath)) {
    // Documented precondition, previously unchecked — and failing silently rather than loudly:
    // the native branch would anchor a relative path at `process.cwd()` while the jiti branch
    // anchored it at CORE's install directory, so one input searched two different trees.
    throw new ThymianBaseError(
      `Cannot load user module ${resolvedPath}: an absolute path is required.`,
      {
        name: 'UserModuleLoadError',
        suggestions: [
          'Resolve the specifier with resolveUserModule first — it always answers an absolute path.',
        ],
      },
    );
  }

  const canonical = canonicalise(resolvedPath);
  const reason = unloadableReason(canonical);

  if (reason !== undefined) {
    throw new ThymianBaseError(
      `Cannot load user module ${canonical}: ${reason}.`,
      {
        name: 'UserModuleLoadError',
        suggestions: [
          'Point at the implementation file rather than its declarations or a non-module asset.',
          'Resolve the specifier with resolveUserModule first — it declines paths that cannot be loaded.',
        ],
      },
    );
  }

  const chain = evaluationChain.getStore() ?? [];

  if (chain.includes(canonical)) {
    throw new ThymianBaseError(
      `Cannot load user module ${canonical}: it is already being evaluated, so the import cycle ` +
        `${[...chain, canonical].join(' -> ')} can never complete.`,
      {
        name: 'UserModuleLoadError',
        suggestions: [
          'Break the cycle by importing the shared module directly instead of loading it through Thymian.',
        ],
      },
    );
  }

  const nested = [...chain, canonical];

  if (!TYPESCRIPT_EXTENSION.test(canonical)) {
    return await evaluationChain.run(nested, () => importNatively(canonical));
  }

  const pending = inFlightTypeScriptLoads.get(canonical);

  if (pending !== undefined) {
    return await pending;
  }

  const load = evaluationChain.run(nested, () => importThroughJiti(canonical));

  inFlightTypeScriptLoads.set(canonical, load);

  try {
    return await load;
  } finally {
    inFlightTypeScriptLoads.delete(canonical);
  }
}
