---
title: 'PluginLoadError'
---

## The Cause

A plugin specifier — passed via `--plugin` or a `path:` in `thymian.config.yaml` — could not be
resolved, could not be loaded, or did not export a valid Thymian plugin. This covers several
distinct causes, each with its own message:

### The plugin specifier could not be resolved

`Cannot resolve plugin "<specifier>".`

The specifier is neither an installed package nor a local file Thymian could find. If you meant
a local file, it must be written as a path (`./my-plugin.ts`) — there is no
`<cwd>/<specifier>` fallback for a bare-looking specifier.

### The specifier resolved, but was refused for what it is

`Cannot load plugin "<specifier>": <reason>.`

The path exists but is not a loadable module kind — for example a `.d.ts` file, an `.mts`/`.cts`
file, a specifier with a missing or unrecognised extension, a mis-cased extension, or (for a
bare specifier) a package that ships unbuilt TypeScript source instead of built JavaScript. See
[Loading Rules and Plugins](/references/loading-rules-and-plugins/) for the full loading
contract.

### A module the plugin imports could not be found

`Cannot load plugin "<specifier>": a module it imports could not be found (<reason>).`

The plugin file itself resolved and began loading, but one of _its own_ imports failed to
resolve — a missing dependency, or a typo in a relative import path inside the plugin.

### The plugin threw while loading

`Cannot load plugin "<specifier>": <underlying error message>`

The plugin module resolved and began executing, but threw before finishing — for example
invalid syntax, or a top-level statement that throws. **A TypeScript plugin loads with no build
step**, so "it didn't compile" is not a cause here; loading does not type-check, so a type error
alone will not produce this message.

### The plugin does not use a default export

`Plugin "<specifier>" does not use a default export.`

The module loaded successfully but does not have a `default` export at all.

### The default export is not a valid Thymian plugin

`"<specifier>" does not default export a valid Thymian plugin.`

The module has a default export, but it does not have the shape of a `ThymianPlugin` — a
`plugin` function, a `name` string, and a `version` string.

## The Solution

- Reference a built `.js`/`.mjs`/`.cjs` file, or a local `.ts` file with an explicit extension.
  An installed package must ship built JavaScript.
- If you meant a local file, use a relative path with an explicit extension (e.g. `./my-plugin.ts`).
- Check that every import inside the plugin resolves.
- Export the plugin with `export default` (ES modules) or `module.exports =` (CommonJS), and make
  sure the exported object has `name`, `version`, and `plugin` — see the
  [plugin developer guide](/guides/plugin-developers-guide/) for the full shape.
