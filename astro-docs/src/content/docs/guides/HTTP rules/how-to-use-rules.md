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
  - './rules/**/*.rule.js' # Local rules
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

3. Check for TypeScript compilation errors:

```bash
tsc --noEmit
```

## Next Steps

- Explore the [CLI commands](/references/plugins/http-linter/cli/) for managing rules
- Learn about [creating custom rules](/guides/http-rules/creating-new-rules/)
- See [combining rule types](/guides/http-rules/combining-types/) for hybrid validation
