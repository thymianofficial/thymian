---
title: 'How To Use Rules'
description: 'Integrating and configuring HTTP linting rules in your projects'
sidebar:
  order: 1
---

Once you've created HTTP rules, you need to integrate them into your API projects. This guide covers loading rules, configuration, and common usage patterns.

## Loading Rules

There are two ways to load rules into Thymian:

### 1. Via Configuration File

Create a `thymian.config.yaml` file in your project root:

```yaml
ruleSets:
  - './rules/**/*.rule.ts' # Local rules
  - '@thymian/rules-rfc-9110' # Npm package

plugins:
  '@thymian/plugin-http-linter': {}
```

### 2. Via CLI flags

```bash
npx thymian lint --rule-set @thymian/rules-rfc-9110
```

## Creating Your Own Rule Set

### File Structure

Organize your rule set as an npm package:

```
my-api-rules/
├── package.json
├── src/
│   ├── index.ts
│   └── rules/
│       ├── authentication/
│       │   └── require-bearer-token.rule.ts
│       ├── headers/
│       │   └── require-correlation-id.rule.ts
│       └── versioning/
│           └── check-api-version.rule.ts
└── tsconfig.json
```

### Package Definition

**package.json:**

```json
{
  "name": "@mycompany/api-rules",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "peerDependencies": {
    "@thymian/plugin-http-linter": "^0.0.1",
    "@thymian/core": "^0.0.1"
  }
}
```

### Rule Set Entry Point

**src/index.ts:**

```typescript
import type { RuleSet } from '@thymian/core';

const myCompanyRules: RuleSet = {
  name: '@mycompany/api-rules',
  url: 'https://api-guidelines.mycompany.com',
  pattern: 'rules/**/*.rule.js', // Glob pattern for built rules
};

export default myCompanyRules;
```

A published rule set ships **built JavaScript** — its entry point (`main` above) is resolved as
a bare specifier, and a package that ships unbuilt TypeScript source is declined. The glob
pattern here matches the rule set's own compiled output under `dist/`, not `src/`. See
[Loading Rules and Plugins](/references/loading-rules-and-plugins/) for the full contract.

### Using Your Rule Set

After publishing your rule set to npm, install it in your project:

```bash
npm install @mycompany/api-rules
```

```yaml
ruleSets:
  - '@mycompany/api-rules'
```

## List Loaded Rules

See which rules are loaded:

```bash
thymian rules list
```

Or with specific rule sources:

```bash
thymian rules list --rule-set ./rules/**/*.rule.ts
```

## Troubleshooting

### Rules Not Loading

**Problem:** Rules aren't being loaded

**Solutions:**

1. Check the glob pattern matches your files:

```bash
ls -la ./rules/**/*.rule.ts
```

2. Verify the rule exports default:

```typescript
export default httpRule('...'); // ✅ Correct
export const myRule = httpRule('...'); // ❌ Wrong
```

3. Check the specifier itself — the most common causes are:

   - **A missing explicit extension.** `--rule-set ./my-rule` does not resolve; write
     `--rule-set ./my-rule.ts`.
   - **A bare specifier that was meant to be local.** There is no `<cwd>/<specifier>`
     fallback — write it as a path (`./my-rule.ts`), not a bare name.
   - **`.mts`, `.cts`, or `.d.ts`.** None of these are loadable — use `.ts`.

   See [Loading Rules and Plugins](/references/loading-rules-and-plugins/) for the full
   contract.

:::note
Loading never type-checks — jiti strips TypeScript types, it does not check them. A rule can
load successfully and still contain type errors. Run `tsc --noEmit` in CI to catch those; it is
a separate concern from whether the rule loads.
:::

## Next Steps

- Explore the [CLI commands](/references/cli/) for managing rules
- Learn about [creating custom rules](/guides/http-rules/creating-new-rules/)
- See [combining rule types](/guides/http-rules/combining-types/) for hybrid validation
