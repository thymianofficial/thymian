---
title: 'UserModuleLoadError'
---

## The Cause

A rule, rule set, or plugin specifier resolved to a file, but the file itself is not a loadable
kind. This is the same underlying check for all three module types, and it declines for one of
the following reasons:

### The file is a TypeScript declaration file

`"<name>.d.ts" is a TypeScript declaration file (.d.ts) — declaration files are never loadable,
regardless of contents.`

A `.d.ts` file is never loadable, no matter what it contains — even if it happens to also
export a value at runtime.

### The file has an `.mts` or `.cts` extension

`".mts" is not a loadable extension — .mts/.cts are not supported for rules, rule sets, or
plugins; use .ts instead.`

Use `.ts` instead — `.mts`/`.cts` are not part of the loadable set.

### The specifier has a missing or unrecognised extension

`"<name>" does not have a loadable extension — expected one of .ts, .js, .mjs, .cjs …`

A local specifier must carry an explicit, loadable extension. There is no extension guessing,
no `index`/directory resolution.

### The extension's casing does not match the file on disk

`".TS" does not match the on-disk casing ".ts" for "<name>.ts" — extension casing is
case-sensitive.`

Extension matching is case-sensitive against the real on-disk casing, even on a
case-insensitive filesystem.

### The specifier does not resolve to a regular file

`"<specifier>" resolves to "<name>", which is not a regular file.`

The path exists but is a directory (or another non-file kind), not a loadable module.

### A bare specifier is a Node.js builtin

`"<specifier>" is a Node.js builtin module — builtins are not loadable user modules.`

Builtin module ids (`http`, `url`, …) are never loadable as rules, rule sets, or plugins.

### A bare specifier resolves to unbuilt TypeScript source

`"<specifier>" ships unbuilt TypeScript source (<file>); publish built JavaScript.`

An installed package must ship built JavaScript (`.js`/`.mjs`/`.cjs`). A package whose resolved
entry point is `.ts`/`.mts`/`.cts` is declined — Thymian does not transpile `node_modules`
dependencies.

## The Solution

Reference a `.ts`, `.js`, `.mjs`, or `.cjs` file with an explicit extension — never `.d.ts`,
`.mts`, or `.cts`. For an installed package, make sure it publishes built JavaScript rather
than TypeScript source. See
[Loading Rules and Plugins](/references/loading-rules-and-plugins/) for the full loading
contract.
