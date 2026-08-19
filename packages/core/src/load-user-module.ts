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
 *    must run exactly once, so concurrent loads of one file share a single in-flight import.
 * 4. **jiti only for TypeScript, imported lazily.** `loadRules` runs on every single invocation
 *    for all built-in rules, and those are JavaScript; that path must never pay for jiti.
 *
 * Three limitations are deliberate and measured against jiti 2.6.1, not oversights:
 *
 * - **TypeScript sources must use `export default`.** `module.exports = …` in a `.ts`/`.cts` file
 *   produces a namespace with no `default` key, and jiti's interop makes that shape *identical*
 *   to a module with only named exports (`interopDefault: false` does not separate them either).
 *   Synthesising a default would let a named-only module masquerade as a rule, so this seam
 *   reports it as "no default export" rather than guessing. Tracked as epic follow-up work.
 * - **`.tsx`/`.mtsx`/`.ctsx` are declined at resolution.** jiti's `jsx` option is off by default,
 *   so dispatching them to jiti yields a bare `ParseError` with no file or line. Declining lets
 *   the caller say "cannot resolve", which is the more useful message.
 * - **A *bare* specifier that resolves only from the user's project still instantiates jiti**,
 *   even when it is plain JavaScript. `require` is anchored to core's install directory, so a
 *   package present only in the user's `node_modules` misses it and reaches the jiti fallback
 *   (measured with `JITI_DEBUG=1`). Contract item 4 therefore holds for Thymian's own bundled
 *   rules — the ones loaded on every invocation — but not for every JavaScript module. Closing
 *   it means re-anchoring `require` at `cwd`, which changes bare-specifier resolution for a
 *   globally installed CLI; deliberately not done here.
 */

import { existsSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Jiti } from 'jiti';

import { isRecord } from './utils.js';

const require = createRequire(import.meta.url);

/** Extensions jiti handles. `.tsx` is excluded on purpose — see the file header. */
const TYPESCRIPT_EXTENSION = /\.[cm]?ts$/;

/**
 * Extensions the dispatch has no working branch for. Declined at resolution so the caller phrases
 * the error, rather than surfacing a jiti `ParseError` or a Node `ERR_UNKNOWN_FILE_EXTENSION`.
 */
const UNSUPPORTED_EXTENSION = /\.[cm]?tsx$/i;

/**
 * Declaration files are never loadable. Case-insensitive: on Windows and default macOS volumes a
 * `Decl.D.TS` resolves fine, and a case-sensitive guard would wave through exactly the file it
 * exists to stop. Checked before {@link TYPESCRIPT_EXTENSION}, which `.d.ts` also matches.
 */
const DECLARATION_FILE = /\.d\.[cm]?ts$/i;

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
      // Defaults only. `interopDefault` already defaults to `true`, and `fsCache` degrades
      // gracefully rather than throwing when its directory is unwritable (measured against
      // 2.6.1) — so a read-only or containerised CI needs no Thymian-specific cache option.
      // `JITI_FS_CACHE=false` is the existing escape hatch if one is ever wanted.
      createJiti(import.meta.url),
    )
    .catch((error: unknown) => {
      jitiInstance = undefined;

      throw error;
    });

  return jitiInstance;
}

/** True for specifiers Node resolves against the importer rather than the `node_modules` chain. */
function isPathLike(specifier: string): boolean {
  return RELATIVE_SPECIFIER.test(specifier) || path.isAbsolute(specifier);
}

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
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
   * Try `<cwd>/<specifier>` on disk before `require.resolve`. Default `true`.
   *
   * Governs **bare** specifiers only, and applies to them only when they name a *file*, so a
   * same-named directory in `cwd` can no longer shadow an installed package. Relative specifiers
   * are always anchored at `cwd` regardless of this flag — they are unambiguously paths.
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
 * @param cwd Directory that path-like specifiers resolve against, and that anchors the jiti
 *   fallback. **Bare** specifiers are resolved through `require.resolve`, which is anchored to
 *   core's own install directory and walks its `node_modules` ancestor chain — `cwd` does not
 *   move that base.
 * @param options See {@link ResolveUserModuleOptions}.
 */
export async function resolveUserModule(
  specifier: string,
  cwd: string = process.cwd(),
  options: ResolveUserModuleOptions = {},
): Promise<string | undefined> {
  const { preferCwdRelative = true } = options;

  let location = specifier;

  if (RELATIVE_SPECIFIER.test(specifier)) {
    // A relative specifier is relative to the USER's cwd, never to core's install directory —
    // but `require` is anchored to the latter and jiti's `parentURL` is only a hint it abandons
    // when the path misses. Both would hand back Thymian's *own* modules as the user's rule
    // (`./index.js` resolves core's barrel), so anchor it here instead of delegating.
    // Unconditional: `preferCwdRelative` governs bare names, and a relative specifier is
    // unambiguously a path.
    location = path.resolve(cwd, specifier);
  } else if (preferCwdRelative) {
    const fileLocation = path.resolve(cwd, specifier);

    // A bare specifier is only preferred when it names a file. A same-named directory in `cwd`
    // would otherwise win and then either fail to resolve or — worse — load a decoy package's
    // code under the name of an installed one.
    if (
      existsSync(fileLocation) &&
      (isPathLike(specifier) || isFile(fileLocation))
    ) {
      location = fileLocation;
    }
  }

  let resolved: string | undefined;

  try {
    resolved = require.resolve(location);
  } catch {
    resolved = await resolveThroughJiti(location, cwd);
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

  if (
    DECLARATION_FILE.test(normalised) ||
    UNSUPPORTED_EXTENSION.test(normalised)
  ) {
    return undefined;
  }

  return normalised;
}

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

async function importThroughJiti(
  resolvedPath: string,
): Promise<Record<string, unknown>> {
  const jiti = await getJiti();
  const module = await jiti.import<unknown>(resolvedPath);

  // `export = <primitive>` yields the bare value, so `'default' in module` would throw a
  // `TypeError`. A non-object export can only ever have been a default.
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
  if (!TYPESCRIPT_EXTENSION.test(resolvedPath)) {
    const module: unknown = await import(pathToFileURL(resolvedPath).href);

    return isRecord(module) ? module : { default: module };
  }

  const pending = inFlightTypeScriptLoads.get(resolvedPath);

  if (pending !== undefined) {
    return await pending;
  }

  const load = importThroughJiti(resolvedPath);

  inFlightTypeScriptLoads.set(resolvedPath, load);

  try {
    return await load;
  } finally {
    inFlightTypeScriptLoads.delete(resolvedPath);
  }
}
