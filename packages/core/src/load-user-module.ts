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
 * 3. **Never import-then-retry.** A retry would run a module's top-level side effects twice.
 * 4. **jiti only for TypeScript, imported lazily.** `loadRules` runs on every single invocation
 *    for all built-in rules, and those are JavaScript; that path must never pay for jiti.
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Jiti } from 'jiti';

const require = createRequire(import.meta.url);

/** Extensions jiti must handle. `.tsx` rides along on the same branch. */
const TYPESCRIPT_EXTENSION = /\.[cm]?tsx?$/;

/** Declaration files are never loadable — checked first, since `.d.ts` also matches above. */
const DECLARATION_FILE = /\.d\.[cm]?ts$/;

/**
 * Memoised as the *promise*, not the resolved instance: `loadRules` resolves rule sources
 * concurrently, and memoising the instance would let several concurrent TypeScript loads each
 * kick off their own `import('jiti')`. The promise makes "imported lazily, once" hold under
 * concurrency too.
 */
let jitiInstance: Promise<Jiti> | undefined;

function getJiti(): Promise<Jiti> {
  // A type-only import of `Jiti` emits nothing under `verbatimModuleSyntax`, so this dynamic
  // import is the only `jiti` reference in the built output — that is what keeps it lazy.
  jitiInstance ??= import('jiti').then(({ createJiti }) =>
    // Defaults only. `interopDefault` already defaults to `true`, and `fsCache` degrades
    // gracefully rather than throwing when its directory is unwritable (measured against
    // 2.6.1) — so a read-only or containerised CI needs no Thymian-specific cache option.
    // `JITI_FS_CACHE=false` is the existing escape hatch if one is ever wanted.
    createJiti(import.meta.url),
  );

  return jitiInstance;
}

async function resolveThroughJiti(
  location: string,
  cwd: string,
): Promise<string | undefined> {
  const jiti = await getJiti();

  // `try: true` makes jiti answer `undefined` instead of throwing. The declared overload
  // widens `try` to `boolean`, which would hide that case, so the annotation restores it.
  const resolvedUrl: string | undefined = jiti.esmResolve(location, {
    try: true,
    // Resolve relative and bare specifiers from the user's project, not from core's `dist/`.
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
  /** Try `<cwd>/<specifier>` on disk before `require.resolve`. Default `true`. */
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
 * @param cwd Directory that cwd-relative and bare specifiers resolve against.
 * @param options See {@link ResolveUserModuleOptions}.
 */
export async function resolveUserModule(
  specifier: string,
  cwd: string = process.cwd(),
  { preferCwdRelative = true }: ResolveUserModuleOptions = {},
): Promise<string | undefined> {
  let location = specifier;

  if (preferCwdRelative) {
    const fileLocation = path.resolve(cwd, specifier);

    if (existsSync(fileLocation)) {
      location = fileLocation;
    }
  }

  let resolved: string | undefined;

  try {
    resolved = require.resolve(location);
  } catch {
    resolved = await resolveThroughJiti(location, cwd);
  }

  if (resolved === undefined || DECLARATION_FILE.test(resolved)) {
    return undefined;
  }

  if (!path.isAbsolute(resolved)) {
    // `require.resolve` answers a builtin specifier with the bare id (`fs`, `node:fs`). That is
    // not a loadable user module, and passing it on would turn into a nonsense
    // `file://<cwd>/node:fs` import rather than the caller's "cannot resolve" message.
    return undefined;
  }

  return resolved;
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
  if (TYPESCRIPT_EXTENSION.test(resolvedPath)) {
    const jiti = await getJiti();

    return await jiti.import<Record<string, unknown>>(resolvedPath);
  }

  const module: Record<string, unknown> = await import(
    pathToFileURL(resolvedPath).href
  );

  return module;
}
