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

Create a `thymian.config.ts` file in your project root:

```yaml
plugins:
  '@thymian/http-linter':
    options:
      rules:
        - './rules/**/*.rule.js', # Local rules
        - '@thymian/rfc-9110-rules', # Npm package
```

### 2. Programmatically

Load rules in your application code:

```typescript
import { Thymian } from '@thymian/core';
import httpLinterPlugin from '@thymian/http-linter';

const thymian = new Thymian().register(httpLinterPlugin, {
  rules: ['./rules/**/*.rule.ts'],
  modes: ['static'],
});

await thymian.run();
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
    "@thymian/http-linter": "^0.0.1",
    "@thymian/core": "^0.0.1"
  }
}
```

### Rule Set Entry Point

**src/index.ts:**

```typescript
import type { RuleSet } from '@thymian/http-linter';

const myCompanyRules: RuleSet = {
  name: '@mycompany/api-rules',
  url: 'https://api-guidelines.mycompany.com',
  pattern: 'rules/**/*.rule.js', // Glob pattern for built rules
};

export default myCompanyRules;
```

### Publishing

```bash
npm run build
npm publish
```

### Using Your Rule Set

```bash
npm install @mycompany/api-rules
```

```yaml
plugins:
  '@thymian/http-linter':
    options:
      rules:
        - '@mycompany/api-rules'
```

## Debugging Rule Loading

### List Loaded Rules

See which rules are loaded:

```bash
thymian http-linter:list
```

Or with specific rule sources:

```bash
thymian http-linter:list --rules ./rules/**/*.rule.ts
```

### Search for Rules

Find rules by description:

```bash
thymian http-linter:search --for "authentication"
```

### Show Rule Statistics

View an overview of loaded rules:

```bash
thymian http-linter:overview
```

Output:

```
┌──────────────┬───────┬──────┬───────┐
│              │ error │ warn │ hint  │
├──────────────┼───────┼──────┼───────┤
│ static       │ 45    │ 23   │ 5     │
│ test         │ 12    │ 8    │ 2     │
│ analytics    │ 38    │ 19   │ 3     │
│ informational│ 15    │ 0    │ 0     │
└──────────────┴───────┴──────┴───────┘
138 rules loaded in total.
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

- Explore the [CLI commands](../../references/plugins/http-linter/cli.md) for managing rules
- Learn about [creating custom rules](creating-new-rules.md)
- See [combining rule types](combining-types.md) for hybrid validation
