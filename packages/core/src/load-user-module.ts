/**
 * The single seam through which Thymian loads a *user-supplied* module — a rule, a rule set or a
 * plugin. Its contract, in order:
 *
 * 1. **Resolve first, load second.** The two steps are separate and separately inspectable:
 *    callers need the resolved path in its own right (`loadRuleSet` uses it as a glob base) and
 *    they need resolution failure to stay distinguishable from load failure, so each keeps its
 *    own user-facing error message. `resolveUserModule` therefore never throws — it answers a
 *    {@link ResolveUserModuleResult} and lets the caller phrase the error. That result is a
 *    DISCRIMINATED UNION rather than `string | undefined` because "does not exist" and "exists
 *    but is not loadable" need different sentences: the seam is the only place that knows which
 *    it is, and every call site would otherwise re-derive it from the specifier it already
 *    failed to resolve.
 * 2. **Dispatch on the *resolved* extension, before any import.** TypeScript goes through jiti,
 *    everything else through a plain dynamic `import()`.
 * 3. **Never import-then-retry, and never evaluate twice.** A module's top-level side effects
 *    must run exactly once — across BOTH dispatch branches, across every spelling of its path,
 *    and under concurrency. A cycle is reported rather than deadlocked — including a cycle formed
 *    by two concurrent roots waiting on each other, which needs the wait-for graph
 *    ({@link blockedOn}) and not just the evaluation chain.
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
 * - **Only JavaScript and TypeScript are loadable**, enforced as an allow-list at resolution,
 *   which hands the caller a `reason` to phrase the error with. See {@link LOADABLE_EXTENSION}
 *   for why each excluded extension is excluded — including `.node`, which is not importable on
 *   the `engines.node` floor at all.
 * - **tsconfig `paths` aliases are not honoured in a user TypeScript module.** jiti is given no
 *   `alias` option and does not read the user's `tsconfig.json`, so a rule importing `@lib/x.js`
 *   under `paths: { "@lib/*": [...] }` resolves and then fails at load with a raw
 *   `MODULE_NOT_FOUND`. Nested *package* imports from the user's own `node_modules` DO work; it is
 *   specifically the alias case. Probably the first limitation a real user writing TypeScript
 *   rules meets. Recorded as deliberately unsupported in story 34.5's documentation criteria.
 *
 * Bare specifiers resolve installed packages first — the user's project, then core's own install
 * directory — and only fall back to `<cwd>/<specifier>` when nothing is installed under that name.
 * Two reasons for that order: a package the user named in their config is theirs, so a globally
 * installed CLI must not answer with its own copy of a colliding name; and preferring the cwd path
 * up front is what let a same-named file or directory shadow an installed package and silently run
 * in its place. Core's anchor stays so Thymian's bundled rule packages keep resolving when the
 * user's project does not carry them.
 *
 * ONE exception, defined by what Node's resolver ANSWERS rather than by a list of names: a plain
 * specifier `require.resolve` reports as a bare builtin id. That is the *bare-requirable* builtins
 * only — `http`, `util`, `punycode` — and NOT the `node:`-prefix-only ones, since
 * `require.resolve('sqlite')` throws and so resolves installed-first like any other name. For that
 * set the installed copy is unreachable by bare specifier through Node's own resolver anyway, so a
 * `<cwd>` DIRECTORY of the same name is allowed to win. A same-named plain FILE is not: `util.js`
 * is an ordinary helper filename, and running it for `rules: ['util']` would be an accident.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Jiti } from 'jiti';

import { ThymianBaseError } from './thymian.error.js';
import { isRecord } from './utils.js';

const require = createRequire(import.meta.url);

/**
 * Cwd-anchored resolvers, memoised. `resolveThroughRequire` runs for every specifier — including
 * every built-in rule on every invocation, the path the file header singles out as needing to stay
 * cheap — and `cwd` is stable within a run, so building the anchor each time was pure waste.
 *
 * Keyed by an **absolute** directory, which {@link resolveUserModule} guarantees by resolving its
 * `cwd` argument once on entry. The key has to be normalised because a *relative* `cwd` is
 * otherwise interpreted at two different times: `pathToFileURL` resolves it against
 * `process.cwd()` when the anchor is BUILT, while every other resolver resolves it again on each
 * CALL. After a `process.chdir` those disagree, the memo hands back an anchor pointing at the old
 * directory, and `require.resolve` misses a package that is plainly installed — so resolution
 * degrades to the jiti fallback and a plain-JavaScript package pays for jiti, which contract item 4
 * forbids. Measured with `JITI_DEBUG=1`: jiti initialised on the second call and not on a control
 * call with an absolute `cwd`. Normalising also collapses `.`, `./x/..` and the absolute spelling of
 * one directory onto a single entry instead of one per spelling.
 */
const cwdRequireCache = new Map<string, NodeJS.Require>();

/** @param cwd An absolute directory — see {@link cwdRequireCache}. */
function requireFrom(cwd: string): NodeJS.Require {
  let anchored = cwdRequireCache.get(cwd);

  if (anchored === undefined) {
    anchored = createRequire(pathToFileURL(path.join(cwd, '_')));
    cwdRequireCache.set(cwd, anchored);
  }

  return anchored;
}

/**
 * Resolves through Node's own resolver, trying the **user's project before core's install
 * directory**.
 *
 * Anchoring only at core's directory (the bare `require` above) meant a package present only in
 * the user's `node_modules` was invisible to it and fell through to the jiti fallback — so a
 * plain-JavaScript rule package paid for jiti, breaking contract item 4 (confirmed with
 * `JITI_DEBUG=1`). It also meant a name the user installed lost to a Thymian dependency of the
 * same name, which for a globally installed CLI is the wrong answer twice over.
 *
 * Only **bare** specifiers are affected: a relative one is already an absolute path by the time it
 * gets here, and both anchors resolve an absolute path identically.
 */
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

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    // Missing, or a path whose parent is not a directory — either way, not a module.
    return false;
  }
}

/** An existing directory. Keeps the discarded-builtin-id fallback to directories — see below. */
function isDirectory(candidate: string): boolean {
  return statSync(candidate, { throwIfNoEntry: false })?.isDirectory() === true;
}

/**
 * The extensions this seam has to guess for itself, in the order unnarrowed jiti guessed them.
 *
 * Narrowing jiti's `extensions` (see {@link getJiti}) narrows what it *guesses* with too, and
 * Node's CJS resolver inside `require.resolve` only ever tried `.js`, `.json` and `.node` — so
 * without this step an extensionless `./my-rule` no longer finds a `my-rule.mjs` on disk.
 */
const GUESSED_EXTENSION = ['.mjs', '.cjs'];

/**
 * Completes extensionless resolution for the two extensions that fall between the resolvers.
 *
 * Ordering is what keeps this a gap-filler rather than a preference: {@link resolveThroughRequire}
 * runs BEFORE it, so a sibling `.js` still wins, and {@link resolveThroughJiti} runs AFTER it, so
 * `.mjs`/`.cjs` still win over a sibling `.ts`. That reproduces jiti's own default order
 * (`.js`, `.mjs`, `.cjs`, `.ts`, …) exactly, which is the point — the narrowing is meant to change
 * which registry a module lands in, not which file a specifier names.
 *
 * Only absolute locations, because guessing is a filesystem question: a bare specifier is a
 * package name until the caller has turned it into a path.
 */
function resolveThroughGuessing(location: string): string | undefined {
  if (!path.isAbsolute(location)) {
    return undefined;
  }

  for (const extension of GUESSED_EXTENSION) {
    const candidate = `${location}${extension}`;

    if (isFile(candidate)) {
      return candidate;
    }
  }

  // Then the directory forms, the same file-before-directory order Node applies to `.js`.
  for (const extension of GUESSED_EXTENSION) {
    const candidate = path.join(location, `index${extension}`);

    if (isFile(candidate)) {
      return candidate;
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
 *
 * Case-SENSITIVE, and that is a measured decision rather than an oversight (#690). On a
 * case-insensitive volume an on-disk `Upper.Rule.JS` resolves perfectly well, but nothing this
 * seam uses can load it: `import()` AND jiti — narrowed to `.ts`/`.mts`/`.cts` above — both answer
 * `ERR_UNKNOWN_FILE_EXTENSION` for `.JS` and for `.TS`. Measured on v26.7.0 only, unlike the
 * version-floor claims above; Node's extension lookup is case-sensitive on the 20/22 matrix too,
 * but that was not re-measured. Relaxing this test to `/i` therefore buys nothing and costs the
 * framing: the file is waved through to exactly that raw error. {@link miscasedExtension} explains
 * such a refusal instead of loosening it.
 *
 * Scoped to the ESM loader on purpose: `require('./A.JS')` SUCCEEDS, because CommonJS falls back to
 * the `.js` handler for an unregistered extension. This seam imports, so the refusal is right — but
 * a user who checks the claim in a `require` REPL must not find it overstated.
 */
const LOADABLE_EXTENSION = /\.[cm]?[jt]s$/;

/**
 * Declaration files are never loadable. Case-insensitive: on Windows and default macOS volumes a
 * `Decl.D.TS` resolves fine, and a case-sensitive guard would wave through exactly the file it
 * exists to stop. Checked before {@link TYPESCRIPT_EXTENSION}, which `.d.ts` also matches.
 */
const DECLARATION_FILE = /\.d\.[cm]?ts$/i;

/** The case-insensitive twin of {@link LOADABLE_EXTENSION}. See {@link miscasedExtension}. */
const MISCASED_EXTENSION = /\.[cm]?[jt]s$/i;

/**
 * The offending extension when a path is refused ONLY because of how that extension is cased, or
 * `undefined` when the path is loadable, or unloadable for some other reason.
 *
 * {@link LOADABLE_EXTENSION} and {@link MISCASED_EXTENSION} disagree on exactly one input — a real
 * module whose on-disk extension is not lower-case — and that input is the only one needing its own
 * sentence. Declaration files are excluded so this agrees with {@link unloadableReason}'s
 * precedence: an upper-case `Legacy.D.TS` is refused for containing no runtime code, which stays
 * true whatever its casing, and must not be reported as a casing mistake.
 *
 * Returns the MATCHED extension rather than `path.extname`, so a real extension is reported
 * verbatim — but a STEM-LESS dotfile is excluded for exactly the reason `path.extname` answers `''`
 * there: a file named a bare `.JS` has no extension at all, and Node loads it through the package
 * `type` (measured, v26.7.0). Calling that a casing mistake would send the user to rename a file
 * that already works, and would make the glob filter fatal on it.
 *
 * Exported so `rule-loader.ts`'s glob filter can separate "cannot be a module at all" (silently
 * dropped) from "is a module, refused only for its casing" (fatal) without parsing a sentence.
 */
export function miscasedExtension(resolvedPath: string): string | undefined {
  if (
    DECLARATION_FILE.test(resolvedPath) ||
    LOADABLE_EXTENSION.test(resolvedPath)
  ) {
    return undefined;
  }

  const matched = MISCASED_EXTENSION.exec(resolvedPath)?.[0];

  if (matched === undefined || path.basename(resolvedPath) === matched) {
    return undefined;
  }

  return matched;
}

/**
 * Why a resolved path can never be loaded, or `undefined` when it can.
 *
 * Shared by both halves of the seam so they cannot drift: `resolveUserModule` passes a reason out
 * as {@link ResolveUserModuleResult.reason}, and `loadUserModule` turns it into a framed error.
 * One sentence, one source — the two halves can never disagree about WHY a path is unloadable.
 * Without the second check a path
 * obtained some other way — a `loadRuleSet` glob, a config `path` — bypasses the guard entirely,
 * and a `.d.ts` then imports as an EMPTY module, so the caller reports "does not use default
 * export": the exact confusion the guard exists to prevent.
 */
export function unloadableReason(resolvedPath: string): string | undefined {
  if (DECLARATION_FILE.test(resolvedPath)) {
    return 'a TypeScript declaration file contains no runtime code';
  }

  const miscased = miscasedExtension(resolvedPath);

  if (miscased !== undefined) {
    // Not "only JavaScript and TypeScript modules can be loaded" — the file the user is looking at
    // plainly IS one, so that sentence reads as a lie and hides the one-word fix (#690).
    return `its extension "${miscased}" must be lower-case — Node's ESM loader and jiti recognise no other spelling`;
  }

  if (!LOADABLE_EXTENSION.test(resolvedPath)) {
    return 'only JavaScript and TypeScript modules can be loaded';
  }

  return undefined;
}

/**
 * A resolver answer that is a plain single segment — no separator, no `:`. `require.resolve` reports
 * a Node builtin as the bare id rather than a path, and only the PLAIN spelling of one is ambiguous
 * enough to be worth a `<cwd>` fallback: a builtin SUBPATH (`fs/promises`) and the explicit `node:`
 * spelling name the builtin unambiguously, so they keep their non-absolute value and are refused by
 * the absolute-path guard at the end of {@link resolveUserModule}.
 */
const PLAIN_ID = /^[^/\\:]+$/;

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
      // item 3 forbids. Narrowing unifies them: one evaluation, `===` identical.
      //
      // It is NOT resolution-neutral, though. jiti derives its guessing list (`additionalExts`)
      // from `extensions` by dropping only `.js`, so narrowing takes `.mjs`, `.cjs` and the JSX
      // family out of extension GUESSING as well as out of the registry — measured on 2.6.1:
      // an extensionless `./my-rule` against a `my-rule.mjs` went from resolved to `undefined`.
      // The JSX family is declined by {@link LOADABLE_EXTENSION} either way, and `.mjs`/`.cjs`
      // are guessed back by {@link resolveThroughGuessing}, so the narrowing costs the registry
      // its `.js` entry and costs resolution nothing. Explicit paths and `.js`→`.ts` NodeNext
      // mapping are unaffected.
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

/**
 * Runs an absolute filesystem location through all three resolvers, in the one order that holds
 * for a path: Node, then the extensions Node does not guess ({@link resolveThroughGuessing}),
 * then jiti for the ones neither knows — `.ts` and NodeNext `.js`→`.ts`.
 *
 * Shared by the relative branch and the bare `<cwd>/<specifier>` fallback so the two cannot
 * drift. They had: the fallback stopped after the guessing step and gated the whole block on
 * `existsSync(<cwd>/<specifier>)`, so `rules: ['my-rule']` against a `<cwd>/my-rule.ts` resolved
 * to nothing — the gate tested the EXTENSIONLESS spelling, which does not exist, and the jiti step
 * it then fell through to was handed the BARE name, which searches `node_modules` only. The very
 * same file resolved fine spelled `./my-rule`. Extensionless local TypeScript is the headline case
 * for this seam, and it is the shape `rule-loader` accepts today, so both branches now run this.
 *
 * No existence gate: every resolver here is already existence-checked internally
 * (`require.resolve` throws, {@link resolveThroughGuessing} calls `isFile`, and
 * {@link resolveThroughJiti} ends on `existsSync`), so the gate only ever removed reachable
 * answers.
 */
async function resolveLocation(
  location: string,
  cwd: string,
): Promise<string | undefined> {
  return (
    resolveThroughRequire(location, cwd) ??
    resolveThroughGuessing(location) ??
    (await resolveThroughJiti(location, cwd))
  );
}

/**
 * The outcome of a resolution attempt.
 *
 * A discriminated union rather than `string | undefined` because the two failure modes are not
 * interchangeable to a user: "there is no such file" and "the file is right there but Thymian
 * cannot load it" want different sentences, and only this seam knows which one applies. Returning
 * `undefined` for both meant the precise sentence {@link unloadableReason} had just produced was
 * discarded one line later, and a `rules: ['./rules.yaml']` was reported as unresolvable.
 *
 * `reason` is optional, not `string | null`, because most failures genuinely have nothing to add
 * beyond "not found" — a caller writes `result.reason ?? <its own default>` and is done. Callers
 * own the *sentence*; this seam owns the *fact*, which is the same split the contract's item 1
 * describes.
 */
export type ResolveUserModuleResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason?: string };

/** Not resolvable, with no more to say about it than that. */
const NOT_RESOLVED: ResolveUserModuleResult = { ok: false };

export interface ResolveUserModuleOptions {
  /**
   * Fall back to `<cwd>/<specifier>` when nothing is installed under that name. Default `true`.
   *
   * A *fallback*, not a preference: installed packages are resolved first, so a same-named file
   * or directory in `cwd` cannot shadow one — except that a `<cwd>` DIRECTORY may win for a
   * bare-requirable builtin name, whose installed path Node's resolver never answers (see the file
   * header). Governs **bare** specifiers only — relative
   * specifiers are always anchored at `cwd` regardless of this flag, being unambiguously paths.
   */
  preferCwdRelative?: boolean;
}

/**
 * Resolves a user-supplied module specifier. Never throws — every failure comes back as
 * `{ ok: false }`, carrying a `reason` when the seam knows something the caller could not work
 * out for itself. On success, `path` is an absolute filesystem path, never a `file://` URL.
 *
 * Resolution stops at the first hit and runs the same three-resolver chain
 * ({@link resolveLocation}) over at most two candidates: the specifier itself, and — for a bare
 * name nothing is installed under, or whose only answer was a bare builtin id — `<cwd>/<specifier>`,
 * which for the builtin-id case must be a directory. Within a candidate the order is
 * `require.resolve`, then a `.mjs`/`.cjs` extension guess ({@link resolveThroughGuessing}), then
 * jiti's `esmResolve`. `require.resolve` already handles TypeScript with an explicit extension, so
 * the jiti step is reached for *resolution* only by extensionless and NodeNext `.js`→`.ts`
 * specifiers. The candidates are exhausted in that order, not the resolvers: a bare name that only
 * jiti can resolve inside `node_modules` still beats a same-named local file.
 *
 * @param specifier The user's rule, rule-set or plugin specifier.
 * @param cwd Directory that path-like specifiers resolve against, that anchors the jiti fallback,
 *   and whose `node_modules` ancestor chain is searched for **bare** specifiers before core's own
 *   (see {@link resolveThroughRequire}).
 * @param options See {@link ResolveUserModuleOptions}.
 * @returns See {@link ResolveUserModuleResult}.
 */
export async function resolveUserModule(
  specifier: string,
  cwd: string = process.cwd(),
  options: ResolveUserModuleOptions = {},
): Promise<ResolveUserModuleResult> {
  const { preferCwdRelative = true } = options;

  // Normalised ONCE, here, so every resolver below and the {@link cwdRequireCache} key agree on
  // which directory `cwd` names. A relative `cwd` is resolved against `process.cwd()` — the
  // behaviour it already had, now stated and now consistent rather than depending on when each
  // resolver happened to look. See {@link cwdRequireCache} for what the inconsistency cost.
  const base = path.resolve(cwd);

  let resolved: string | undefined;

  if (RELATIVE_SPECIFIER.test(specifier)) {
    // A relative specifier is relative to the USER's cwd, never to core's install directory —
    // but `require` is anchored to the latter and jiti's `parentURL` is only a hint it abandons
    // when the path misses. Both would hand back Thymian's *own* modules as the user's rule
    // (`./index.js` resolves core's barrel), so anchor it here instead of delegating.
    // Unconditional: `preferCwdRelative` governs bare names, and a relative specifier is
    // unambiguously a path.
    resolved = await resolveLocation(path.resolve(base, specifier), base);
  } else {
    // Installed packages FIRST — through all three resolvers, not just the first two. The third
    // one earns its place: a bare SUBPATH whose target is TypeScript (`my-pkg/rules`, or its
    // NodeNext `my-pkg/rules.js` spelling, against a `node_modules/my-pkg/rules.ts`) is refused
    // by `require.resolve` and answered by jiti — measured, both spellings. A package whose
    // `main` is TypeScript needs no help here; `require.resolve` already returns it.
    //
    // So this step has to run before the cwd fallback, not after it: otherwise a local
    // `<cwd>/my-pkg/rules.ts` would shadow the installed `my-pkg/rules.ts`, which is the one
    // thing the installed-first order exists to prevent. Preferring `<cwd>/<specifier>` up front
    // is what let a same-named local file or directory shadow — and silently execute in place
    // of — an installed package.
    resolved =
      resolveThroughRequire(specifier, base) ??
      resolveThroughGuessing(specifier) ??
      (await resolveThroughJiti(specifier, base));

    // A plain non-absolute answer is not an answer. `require.resolve` reports a Node builtin as the
    // bare id (`http`), which is truthy — so the `??` chain stopped there and the candidate below
    // was never tried. A user whose config said `rules: ['http']`, meaning their own `<cwd>/http/`
    // directory of rules, was told "cannot resolve http" with the directory sitting on disk.
    //
    // Narrow on purpose ({@link PLAIN_ID}): `fs/promises` and `node:fs` name the builtin
    // unambiguously, so they are NOT discarded and the absolute-path guard below refuses them —
    // which is what keeps that guard load-bearing. It also keeps `node:fs` away from
    // `path.resolve` for the builtin `node:` names, where on Windows the joined path would be an
    // NTFS alternate-data-stream reference. A `node:`-spelled NON-builtin (a typo, or a
    // prefix-only name on an older runtime) is not answered as a bare id at all, so it still
    // reaches `path.resolve`; the guarantee is about what the resolver answered, not the spelling.
    // {@link PLAIN_ID} alone defines the discard set — the thing to look at before widening this.
    // No `path.isAbsolute` test is needed: no absolute spelling on any platform can match it.
    const discardedBareId = resolved !== undefined && PLAIN_ID.test(resolved);

    if (discardedBareId) {
      resolved = undefined;
    }

    if (
      resolved === undefined &&
      preferCwdRelative &&
      !path.isAbsolute(specifier)
    ) {
      // Nothing is installed under that name, so a local file or directory of that name is what
      // the user meant. Resolving the absolute path (rather than using it verbatim) keeps a
      // directory holding `index.js` or a `package.json` `main` working, which is the shape
      // today's `rule-loader` accepts for `rules: ['my-rules']`.
      const candidate = path.resolve(base, specifier);

      // For a name reached here only by discarding a builtin id, the candidate must be a
      // DIRECTORY. `util.js`, `os.js`, `path.js`, `events.js` are ordinary root-level helper
      // filenames; executing one for `rules: ['util']` is an accident, where a directory named
      // after a builtin is deliberate. Ordinary bare names keep accepting a plain file, as before.
      // It also keeps the answer honest when the only local candidate is a non-module:
      // `<cwd>/http.json` is not a directory, so this reports a plain "not found" rather than a
      // `reason` about JSON support for a file the user never named.
      if (!discardedBareId || isDirectory(candidate)) {
        resolved = await resolveLocation(candidate, base);
      }
    }
  }

  if (resolved === undefined) {
    return NOT_RESOLVED;
  }

  if (!path.isAbsolute(resolved)) {
    // `require.resolve` answers a builtin specifier with the bare id (`fs`, `node:fs`). That is
    // not a loadable user module, and passing it on would turn into a nonsense
    // `file://<cwd>/node:fs` import rather than the caller's "cannot resolve" message.
    return NOT_RESOLVED;
  }

  let normalised: string;

  try {
    // `native` reports the *on-disk* casing. Both resolvers echo the caller's spelling, so on a
    // case-insensitive volume `./Rule.TS` would otherwise reach a dispatch that matches neither
    // branch. Symlinks are unaffected: both resolvers already return realpaths.
    normalised = realpathSync.native(resolved);
  } catch {
    return NOT_RESOLVED;
  }

  const reason = unloadableReason(normalised);

  if (reason !== undefined) {
    // The one failure the caller cannot work out for itself: the path EXISTS and resolved
    // cleanly, and is refused only because of what it is. Reported as `{ ok: false }` with no
    // reason, this became "cannot resolve <path>" — telling the user a file they are looking at
    // cannot be found.
    return { ok: false, reason };
  }

  return { ok: true, path: normalised };
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
 *
 * It catches re-entry on ONE path and nothing more, which is all a per-path structure can do. Two
 * roots entering concurrently and waiting on each other is the same defect through a door no chain
 * can see; {@link blockedOn} is what closes that one, and the two work together rather than either
 * replacing the other.
 */
const evaluationChain = new AsyncLocalStorage<readonly string[]>();

/**
 * In-flight TypeScript loads, keyed by resolved path. jiti only populates its module cache once a
 * load *completes*, so without this two concurrent loads of one file evaluate it twice and return
 * two distinct namespaces — the double-evaluation contract item 3 forbids. Node's own loader
 * de-duplicates in flight, so the native branch needs no equivalent.
 *
 * De-duplication ONLY. Whether a wait is safe to join is {@link blockedOn}'s question, and the two
 * are deliberately not the same lookup — see there for what conflating them cost.
 */
const inFlightTypeScriptLoads = new Map<
  string,
  Promise<Record<string, unknown>>
>();

/**
 * Which in-flight evaluation is blocked on which — the wait-for graph.
 *
 * Separate state from {@link inFlightTypeScriptLoads} on purpose. That map answers "is this file
 * already loading", and the evaluation chain answers "am I already inside this file"; NEITHER can
 * answer "would waiting for this file close a ring", and making one lookup serve both is what
 * deadlocked two concurrent roots. `loadRules` fans out with `Promise.all`, so:
 *
 * - root A starts `a` with chain `[a]`; root B starts `b` with chain `[b]`
 * - `a`'s top level asks for `b`: chain `[a]` does not contain `b`, so the in-flight entry is
 *   awaited and the chain is never extended
 * - `b`'s top level does the mirror image, and the two promises await each other
 *
 * The missing information is *dynamic*, which is why no per-path chain can supply it: at the moment
 * B decides, the fact that matters is that `a`'s evaluation is ALREADY waiting on `b`. Threading
 * the chain as an explicit parameter instead of through `AsyncLocalStorage` carries exactly the
 * same per-path information and misses this identically.
 *
 * Keyed by the canonical path of the module doing the waiting, holding every path it currently
 * awaits — a top level may await several at once. Entries live only for the duration of a wait.
 */
const blockedOn = new Map<string, Set<string>>();

/**
 * The chain of waits leading from `start` to `target`, or `undefined` when `start` is not waiting
 * on `target` however indirectly. Returns the path rather than a boolean so the error can name the
 * real ring (`b -> a -> b`) instead of the two modules that happened to notice it.
 *
 * Depth is bounded by the number of modules evaluating concurrently, so a plain guarded DFS is the
 * right size of machinery here. `seen` makes it safe against the rings it is looking for.
 */
function waitPathTo(
  start: string,
  target: string,
  seen: Set<string> = new Set(),
): readonly string[] | undefined {
  if (seen.has(start)) {
    return undefined;
  }

  seen.add(start);

  for (const next of blockedOn.get(start) ?? []) {
    if (next === target) {
      return [start, target];
    }

    const rest = waitPathTo(next, target, seen);

    if (rest !== undefined) {
      return [start, ...rest];
    }
  }

  return undefined;
}

/**
 * Awaits another evaluation's in-flight load with the wait recorded, so that a third evaluation
 * arriving mid-wait can see this one and report the ring instead of joining the pile-up.
 *
 * The edge is removed in `finally` rather than on success: a rejected load frees the waiter just as
 * a resolved one does, and a stale edge would make the next unrelated wait look like a cycle.
 */
async function awaitRecorded(
  waiter: string,
  awaited: string,
  pending: Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  let edges = blockedOn.get(waiter);

  if (edges === undefined) {
    edges = new Set();
    blockedOn.set(waiter, edges);
  }

  edges.add(awaited);

  try {
    return await pending;
  } finally {
    edges.delete(awaited);

    if (edges.size === 0) {
      blockedOn.delete(waiter);
    }
  }
}

/**
 * One sentence for both ways a cycle is found — self re-entry on one path, and two paths waiting on
 * each other — because to a user they are the same defect and want the same fix. `ring` is rendered
 * as given, so each caller passes a closed loop.
 */
function cycleError(
  canonical: string,
  ring: readonly string[],
): ThymianBaseError {
  return new ThymianBaseError(
    `Cannot load user module ${canonical}: it is already being evaluated, so the import cycle ` +
      `${ring.join(' -> ')} can never complete.`,
    {
      name: 'UserModuleLoadError',
      suggestions: [
        'Break the cycle by importing the shared module directly instead of loading it through Thymian.',
      ],
    },
  );
}

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
        // Matched to the diagnosis. "Point at the implementation file rather than its declarations"
        // is FALSE for a mis-cased module — it IS the implementation file, which is the same class
        // of lie #690 exists to remove.
        suggestions:
          miscasedExtension(canonical) === undefined
            ? [
                'Point at the implementation file rather than its declarations or a non-module asset.',
                'Resolve the specifier with resolveUserModule first — it declines paths that cannot be loaded.',
              ]
            : ['Rename the file so its extension is lower-case.'],
      },
    );
  }

  const chain = evaluationChain.getStore() ?? [];

  if (chain.includes(canonical)) {
    throw cycleError(canonical, [...chain, canonical]);
  }

  const nested = [...chain, canonical];

  if (!TYPESCRIPT_EXTENSION.test(canonical)) {
    return await evaluationChain.run(nested, () => importNatively(canonical));
  }

  const pending = inFlightTypeScriptLoads.get(canonical);

  if (pending !== undefined) {
    // Another evaluation owns this load. Waiting for it is not just allowed but required — it is
    // what makes "exactly once" hold under concurrency — with one exception: when that evaluation
    // is itself waiting, directly or transitively, on the module being evaluated right here. Then
    // the waits close a ring that no return can break.
    const waiter = chain.at(-1);

    if (waiter === undefined) {
      // A root call. Nothing is being evaluated on this path, so joining a wait cannot close a
      // ring — at worst this caller waits for a cycle someone else is about to report.
      return await pending;
    }

    const ring = waitPathTo(canonical, waiter);

    if (ring !== undefined) {
      throw cycleError(canonical, [waiter, ...ring]);
    }

    return await awaitRecorded(waiter, canonical, pending);
  }

  const load = evaluationChain.run(nested, () => importThroughJiti(canonical));

  inFlightTypeScriptLoads.set(canonical, load);

  try {
    return await load;
  } finally {
    inFlightTypeScriptLoads.delete(canonical);
  }
}
