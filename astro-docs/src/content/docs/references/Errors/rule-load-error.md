---
title: 'RuleLoadError'
---

## The Cause

### A rule module does not export its rule using a default export

A rule module was loaded but does not export its rule using a default export. Thymian rules and rule sets must be exported using `export default` (ES modules) or `module.exports =` (CommonJS).

### The rule source specifier could not be resolved

`Cannot resolve rule source <input>.`

The rule source could not be found. A `ruleSets:` config entry is a rule-set **package** name;
a `--rule-set` value is a package **or** a local path with an explicit extension. This error
means the specifier matched neither an installed package nor — for a local `--rule-set` path —
a file on disk.

### The rule source specifier resolved, but was refused for what it is

`Cannot load rule source <input>: <reason>.`

The path exists but is not a loadable module kind — see
[UserModuleLoadError](/references/errors/user-module-load-error/) for the full list of reasons
(a `.d.ts` file, `.mts`/`.cts`, a missing extension, unbuilt TypeScript in a package, …).

### A glob-matched rule set file failed to load

`Rule set "<name>" failed to load "<path>": <error>`

A file matched by a rule set's glob pattern resolved and began loading, but threw before
finishing (a syntax error, a throwing top-level statement).

### A glob matched a nested rule set

`"<path>" is a rule set; rule sets cannot contain rule sets.`

Rule sets are flat: a glob match whose default export is itself a rule set is an error, not a
nested load. See [Loading Rules and Plugins](/references/loading-rules-and-plugins/#rule-sets-are-flat).

### A glob matched files but produced no loadable rules

`Rule set "<name>" pattern matched files but produced no loadable rules.`

The glob pattern matched at least one file, but none of the matches were loadable rules — this
throws rather than silently resolving to an empty rule set.

## The Solution

Make sure your rule file exports the rule or rule set as the default export.

For example, if you have a rule file `my-rule.ts`:

```typescript
// ❌ Incorrect - named export
export const myRule = {/* rule definition */};

// ✅ Correct - default export
export default {/* rule definition */};
```

For the resolution and loading causes above, check the specifier or glob pattern matches the
file you intended, and that the file is a loadable kind — see
[Loading Rules and Plugins](/references/loading-rules-and-plugins/) for the full contract.
