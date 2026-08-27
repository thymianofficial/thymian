---
title: 'Loading Rules and Plugins'
description: 'The contract Thymian uses to load rule, rule set, and plugin modules — the loadable set, bare vs. local specifiers, and what is (and is not) checked.'
---

Rules, rule sets, and plugins are all loaded through the same mechanism. This page is the
normative reference for that mechanism: which files it will load, how it tells a package
specifier from a local path, and what it deliberately does not check.

## The loadable set

TypeScript is the **default** authoring path. A `.ts` rule, rule set entry point, or plugin
loads with **no build step and no Node flags** — Thymian transpiles it on the fly.

The loadable set is closed:

- **`.ts`** — loaded via [jiti](https://github.com/unjs/jiti).
- **`.js` / `.mjs` / `.cjs`** — loaded via native `import()`.

**`.mts` and `.cts` are not supported.** `.d.ts` is **never** loadable, whatever it contains —
a declaration file is not runnable source, regardless of its extension matching otherwise.

## Bare vs local specifiers

Every specifier you pass to `--rule-set`, `--plugin`, a `ruleSets:` entry, or a plugin `path:`
is exactly one of two kinds, decided syntactically:

- **Bare specifier** — an installed package. It resolves through your project first, then
  Thymian's own install, using Node's own resolver. The resolved file must be built JavaScript
  (`.js` / `.mjs` / `.cjs`). **A package that ships unbuilt TypeScript is declined** — it must
  publish built output. A Node.js builtin id (`http`, `url`, …) is also declined; builtins are
  not loadable user modules.
- **Local specifier** — a relative (`./`, `../`) or absolute path with an **explicit
  extension**. There is no extension guessing, no `index`/directory resolution, and **no
  `<cwd>/<specifier>` fallback** — a bare specifier never falls back to a local file. If you
  meant a local file, write it as a path.

**The explicit-extension rule applies to the top-level specifier only.** Imports _inside_ a
loaded module keep working exactly as they do in any Node/TypeScript project — a `.ts` rule
that does `import './helper.js'` for a file actually named `helper.ts` resolves normally
through jiti/NodeNext, because that resolution never goes through this loading contract.

Extension matching is **case-sensitive against the on-disk casing**. A mis-cased extension
(e.g. requesting `.TS` for a file that is actually `.ts`) is declined, naming the casing
mismatch rather than silently loading or silently skipping it.

## What is not checked at load

**Loading does not type-check.** jiti strips TypeScript types to transpile a `.ts` file; it
does not check them. If you want type errors caught, run `tsc --noEmit` — typically in CI, since
it is a separate step from loading.

**`erasableSyntaxOnly` is not required of your code.** That restriction belongs to Node's own
experimental type-stripping feature, which Thymian does not use. Because loading goes through
jiti instead, `enum`, `namespace`, parameter properties, and decorators all load normally.

**`tsconfig.json` `paths` aliases are not honoured.** This is deliberate, so module resolution
stays predictable regardless of which `tsconfig.json` (if any) happens to be nearby. Do not
configure `paths` and expect Thymian to resolve through them.

## Rule sets are flat

A rule set's glob pattern selects individual rule files. **A rule set cannot contain another
rule set** — if a glob match's default export is itself a rule set, that is an error, not a
nested load.

## Globs

`ruleSets:` entries and `--rule-set` values may be glob patterns. Their matching has a few
fixed behaviours:

- `node_modules` is excluded by default.
- A rule set's own file is excluded from its own matches (it can't self-select).
- A match that resolves to a non-loadable kind (wrong extension, `.d.ts`, a broken symlink, …)
  is **skipped**, with a stated reason — it does not fail the set by itself.
- A matched file that **fails while loading** (a syntax error, a throwing top-level statement)
  **fails the whole set**.
- A glob that matched files but produced **zero** loadable rules **throws** — it never silently
  resolves to an empty rule set.
- Load order is deterministic: matches are sorted before loading.

## Where transpiled output is cached

jiti's filesystem transpile cache is pinned to `~/.cache/thymian/jiti` — per-user, and
deliberately **not** the shared OS temp directory (a world-writable cache location would let
another local user plant a poisoned entry).

## Migration

If you're updating from before this loading contract, these are the breaking changes:

- **Extensionless top-level specifiers no longer resolve.** Write the extension explicitly:
  `--rule-set my-rule` → `--rule-set ./my-rule.ts`.
- **The `<cwd>/<specifier>` bare-to-local fallback is gone.** A local file must be written as a
  path (`./` or `../` or absolute) — a bare-looking specifier no longer falls back to resolving
  against the working directory.
- **`.mts` / `.cts` are no longer loadable** for rules, rule sets, or plugins. Use `.ts`.
- **TypeScript-source packages in `node_modules` no longer load.** A dependency must ship built
  JavaScript; publishing `.ts` source and relying on Thymian to transpile it is no longer
  supported.
